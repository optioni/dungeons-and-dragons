import type Anthropic from '@anthropic-ai/sdk';
import type Redis from 'ioredis';

import { EntityManager } from '@mikro-orm/postgresql';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job } from 'bullmq';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type EnvironmentConfig } from '../config/environment.validation.js';
import { ANTHROPIC_CLIENT, BACKGROUND_MODEL, MemoryService } from '../memory/memory.service.js';
import { REDIS_CLIENT } from '../queue/queue.module.js';
import { NpcItem } from './entities/npc-item.entity.js';
import { NpcRelationship } from './entities/npc-relationship.entity.js';
import { Npc } from './entities/npc.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';
import { NpcMemoryService } from './npc-memory.service.js';
import { NpcRelationshipType, WorldEventSource, WorldEventStatus } from './world.enums.js';
import { WorldService } from './world.service.js';

interface WorldTickJobPayload {
    campaignId: number
}

interface AgendaOutcome {
    npcId: number
    agenda: string
    nextTickInGameDay: number
    newLocationId?: number | null
    departureDescription?: string | null
}

interface ConversationOutcome {
    sourceNpcId: number
    targetNpcId: number
    relationshipChange?: {
        type: NpcRelationshipType
        description: string
    } | null
    itemExchanged?: {
        npcItemId: number
        toNpcId: number
    } | null
    newAgendaSource?: string | null
    newAgendaTarget?: string | null
    sharedMemories: Array<{
        receiverNpcId: number
        content: string
        senderNpcId: number
    }>
}

interface TickOutcomeBatch {
    agendaOutcomes: AgendaOutcome[]
    conversationOutcomes: ConversationOutcome[]
    departureEvents: Array<{
        campaignId: number
        locationId: number
        description: string
    }>
    catastropheEvent?: {
        campaignId: number
        locationId?: number | null
        description: string
    } | null
}

// 10 minutes
const LOCK_TTL_SECONDS = 600;

/**
 * BullMQ worker for the world-tick queue. Processes NPC agendas, conversations,
 * and catastrophe rolls in strict sequence for a given campaign.
 */
@Processor('world-tick')
export class WorldTickWorker extends WorkerHost {
    private readonly logger = new Logger(WorldTickWorker.name);

    constructor(
        private readonly em: EntityManager,
        private readonly worldService: WorldService,
        private readonly memoryService: MemoryService,
        private readonly npcMemoryService: NpcMemoryService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Pick<Anthropic, 'messages'>,
        @Inject(BACKGROUND_MODEL) private readonly backgroundModel: string,
        private readonly config: ConfigService<EnvironmentConfig>,
    ) {
        super();
    }

    /**
     * Main entry point for the world-tick job. Acquires a Redis lock to prevent
     * overlapping ticks, then runs the sequenced world tick pipeline.
     */
    async process(job: Job<WorldTickJobPayload>): Promise<{ status: string }> {
        const { campaignId } = job.data;
        this.logger.log(`World tick received: jobId=${job.id} campaignId=${campaignId}`);

        const lockKey = `campaignLocked:${campaignId}`;

        const acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
        if (acquired === null) {
            this.logger.warn(`World tick skipped: campaignId=${campaignId} reason=lock_held`);
            return { status: 'skipped' };
        }

        this.logger.log(`World tick lock acquired: campaignId=${campaignId}`);

        try {
            return await this.runTick(campaignId, job.id);
        } finally {
            await this.redis.del(lockKey);
        }
    }

    /**
     * Executes the full world tick pipeline: agendas → conversations → outcomes → catastrophe → diary.
     */
    private async runTick(campaignId: number, jobId: string | undefined): Promise<{ status: string }> {
        const tickStartedAt = Date.now();

        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) {
            this.logger.error(`World tick campaign not found: jobId=${jobId} campaignId=${campaignId}`);
            return { status: 'campaign_not_found' };
        }

        const inGameDate = campaign.inGameDate ?? 'Day 1';
        const inGameDay = campaign.inGameDay ?? 1;
        const maxNpcs = this.config.get<number>('MAX_NPCS_PER_TICK', 10);

        const batch: TickOutcomeBatch = {
            agendaOutcomes: [],
            conversationOutcomes: [],
            departureEvents: [],
        };

        // Step 1: NPC agenda evaluation
        const dueNpcs = await this.worldService.getDueNpcs(campaignId, inGameDay, maxNpcs);
        const conversationPairs = await this.worldService.getConversationPairs(campaignId);
        this.logger.log(`World tick pipeline start: campaignId=${campaignId} dueNpcs=${dueNpcs.length} conversationPairs=${conversationPairs.length}`);

        this.logger.log(`World tick phase: campaignId=${campaignId} phase=agenda_evaluation`);
        if (dueNpcs.length > 0) {
            const agendaOutcomes = await this.evaluateAgendas(dueNpcs, inGameDay, campaignId);
            batch.agendaOutcomes = agendaOutcomes;

            for (const outcome of agendaOutcomes) {
                if (outcome.newLocationId !== null && outcome.departureDescription) {
                    const npc = dueNpcs.find((dueNpc) => dueNpc.id === outcome.npcId);
                    if (npc && npc.currentLocationId !== null) {
                        batch.departureEvents.push({
                            campaignId,
                            locationId: npc.currentLocationId,
                            description: outcome.departureDescription,
                        });
                    }
                }
            }

            this.logger.log(`World tick agenda outcomes: campaignId=${campaignId} evaluated=${dueNpcs.length} succeeded=${agendaOutcomes.length} failed=${dueNpcs.length - agendaOutcomes.length}`);
        }

        // Step 2: NPC conversations
        this.logger.log(`World tick phase: campaignId=${campaignId} phase=conversations`);
        if (conversationPairs.length > 0) {
            batch.conversationOutcomes = await this.runConversations(conversationPairs);
            this.logger.log(`World tick conversation outcomes: campaignId=${campaignId} pairs=${conversationPairs.length} processed=${batch.conversationOutcomes.length}`);
        }

        // Step 3: Apply all outcomes atomically
        await this.applyOutcomes(batch, dueNpcs);

        // Step 4: Catastrophe roll
        await this.rollCatastrophe(campaignId, inGameDate);

        // Step 5: Diary entry (fire-and-forget, errors are non-fatal)
        this.logger.log(`World tick phase: campaignId=${campaignId} phase=diary_write`);
        void (async () => {
            try {
                await this.memoryService.writeDiaryEntry(campaignId, inGameDate, []);
                this.logger.log(`World tick diary write success: campaignId=${campaignId}`);
            } catch (error: unknown) {
                this.logger.error(`World tick diary write failed: campaignId=${campaignId}`, error);
            }
        })();

        const duration = Date.now() - tickStartedAt;
        this.logger.log(`World tick complete: campaignId=${campaignId} duration=${duration}ms`);
        return { status: 'ok' };
    }

    /**
     * Groups NPCs by location, then evaluates agendas in parallel for independent NPCs
     * and sequentially for co-located NPCs.
     */
    async evaluateAgendas(npcs: Npc[], inGameDay: number, campaignId: number): Promise<AgendaOutcome[]> {
        const byLocation = groupByLocation(npcs);
        const outcomes: AgendaOutcome[] = [];

        const independentGroups: Npc[][] = [];
        const coLocatedGroups: Npc[][] = [];

        for (const [, group] of byLocation) {
            if (group.length === 1) {
                independentGroups.push(group);
            } else {
                coLocatedGroups.push(group);
            }
        }

        // Parallel for independent NPCs
        const parallelResults = await Promise.all(
            independentGroups.flat().map((npc) => this.evaluateSingleNpcAgenda(npc, inGameDay, campaignId)),
        );
        outcomes.push(...parallelResults.filter((result): result is AgendaOutcome => result !== null));

        // Sequential for co-located NPCs
        for (const group of coLocatedGroups) {
            for (const npc of group) {
                const result = await this.evaluateSingleNpcAgenda(npc, inGameDay, campaignId);
                if (result !== null) {
                    outcomes.push(result);
                }
            }
        }

        return outcomes;
    }

    /** Calls Haiku to evaluate a single NPC's agenda and returns a structured outcome. */
    private async evaluateSingleNpcAgenda(
        npc: Npc,
        inGameDay: number,
        campaignId: number,
    ): Promise<AgendaOutcome | null> {
        try {
            const memoryLimit = this.config.get<number>('NPC_MEMORY_AGENDA_LIMIT', 5) ?? 5;
            const relevantMemories = npc.agenda?.trim()
                ? await this.npcMemoryService.searchNpcMemories(npc.id, npc.agenda, memoryLimit)
                : [];
            const locations = await this.em.find(
                (await import('./entities/location.entity.js')).Location,
                { campaignId },
                { fields: ['id', 'name'] as never },
            );
            const locationList = locations
                .map((loc: { id: number; name: string }) => `${loc.id}: ${loc.name}`)
                .join(', ');
            const recentMemoriesSection = relevantMemories.length > 0
                ? `\n\n## Recent Memories\n${relevantMemories.map((memory) => `- ${memory.content}`).join('\n')}`
                : '';

            const agendaCallStartedAt = Date.now();
            /* eslint-disable @typescript-eslint/naming-convention */
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 400,
                system: 'You are a world simulation engine for a D&D campaign. Respond only with valid JSON.',
                messages: [
                    {
                        role: 'user',
                        content: `Evaluate this NPC's agenda. Current in-game day: ${inGameDay}.

NPC: ${npc.name}
Profession: ${npc.profession ?? 'unknown'}
Personality: ${(npc.personalityTraits as string[]).join(', ')}
Current agenda: ${npc.agenda ?? 'none'}
Current location ID: ${npc.currentLocationId ?? 'unknown'}
${recentMemoriesSection}

Available locations: ${locationList}

Respond with JSON:
{
  "agenda": "updated agenda text",
  "nextTickInGameDay": <integer day number for next evaluation, e.g. ${inGameDay + 3}>,
  "newLocationId": <number or null>,
  "departureDescription": "<narrative of departure, or null if not moving>"
}`,
                    },
                ],
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            const agendaCallDuration = Date.now() - agendaCallStartedAt;
            this.logger.log(`Anthropic call complete: provider=anthropic model=${this.backgroundModel} context=npc_agenda npcId=${npc.id} duration=${agendaCallDuration}ms success=true`);

            const text = response.content.find((b) => b.type === 'text');
            if (!text || text.type !== 'text') {
                return null;
            }

            const parsed = JSON.parse(text.text) as {
                agenda: string
                nextTickInGameDay: number
                newLocationId?: number | null
                departureDescription?: string | null
            };

            return {
                npcId: npc.id,
                agenda: parsed.agenda,
                nextTickInGameDay: parsed.nextTickInGameDay,
                newLocationId: parsed.newLocationId ?? null,
                departureDescription: parsed.departureDescription ?? null,
            };
        } catch (error) {
            const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
            this.logger.error(`Anthropic call failed: provider=anthropic model=${this.backgroundModel} context=npc_agenda npcId=${npc.id} errorClass=${errorClass}`);
            return null;
        }
    }

    /**
     * Runs structured 2-turn Haiku conversations for co-located NPC pairs with relationships.
     */
    async runConversations(pairs: NpcRelationship[]): Promise<ConversationOutcome[]> {
        const outcomes: ConversationOutcome[] = [];
        const usedNpcIds = new Set<number>();

        for (const rel of pairs) {
            if (usedNpcIds.has(rel.sourceNpcId) || usedNpcIds.has(rel.targetNpcId)) {
                continue;
            }

            const outcome = await this.runSingleConversation(rel);
            if (outcome !== null) {
                outcomes.push(outcome);
                usedNpcIds.add(rel.sourceNpcId);
                usedNpcIds.add(rel.targetNpcId);
            }
        }

        return outcomes;
    }

    /** Calls Haiku to simulate a 2-turn dialogue between two NPCs. */
    private async runSingleConversation(rel: NpcRelationship): Promise<ConversationOutcome | null> {
        try {
            const [sourceNpc, targetNpc] = await Promise.all([
                this.em.findOne(Npc, { id: rel.sourceNpcId }),
                this.em.findOne(Npc, { id: rel.targetNpcId }),
            ]);

            if (!sourceNpc || !targetNpc) {
                return null;
            }

            const memoryLimit = this.config.get<number>('NPC_MEMORY_CONVERSATION_LIMIT', 3) ?? 3;
            const [sourceMemories, targetMemories] = await Promise.all([
                this.npcMemoryService.searchNpcMemories(sourceNpc.id, targetNpc.name, memoryLimit),
                this.npcMemoryService.searchNpcMemories(targetNpc.id, sourceNpc.name, memoryLimit),
            ]);
            const sourceMemorySection = sourceMemories.length > 0
                ? `\nRecent memories for ${sourceNpc.name}:\n${sourceMemories.map((memory) => `- ${memory.content}`).join('\n')}`
                : '';
            const targetMemorySection = targetMemories.length > 0
                ? `\nRecent memories for ${targetNpc.name}:\n${targetMemories.map((memory) => `- ${memory.content}`).join('\n')}`
                : '';

            const convCallStartedAt = Date.now();
            /* eslint-disable @typescript-eslint/naming-convention */
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 600,
                system: 'You are a world simulation engine for a D&D campaign. Respond only with valid JSON.',
                messages: [
                    {
                        role: 'user',
                        content: `Simulate a 2-turn conversation between these NPCs. They are co-located.

NPC A (${sourceNpc.name}): ${sourceNpc.profession ?? 'unknown'}, personality: ${(sourceNpc.personalityTraits as string[]).join(', ')}, speech style: ${sourceNpc.speechStyle ?? 'normal'}
NPC B (${targetNpc.name}): ${targetNpc.profession ?? 'unknown'}, personality: ${(targetNpc.personalityTraits as string[]).join(', ')}, speech style: ${targetNpc.speechStyle ?? 'normal'}
Relationship: ${rel.type} — ${rel.description ?? 'no description'}
${sourceMemorySection}${targetMemorySection}

Respond with JSON:
{
  "dialogue": [{"speaker": "A", "line": "..."}, {"speaker": "B", "line": "..."}],
  "relationshipChange": {"type": "<NpcRelationshipType or null>", "description": "..."} | null,
  "itemExchanged": {"npcItemId": <number>, "toNpcId": <number>} | null,
  "newAgendaSource": "<new agenda for ${sourceNpc.name} or null>",
  "newAgendaTarget": "<new agenda for ${targetNpc.name} or null>",
  "sharedMemories": [{"receiverNpcId": <number>, "content": "...", "senderNpcId": <number>}]
}`,
                    },
                ],
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            const convCallDuration = Date.now() - convCallStartedAt;
            this.logger.log(`Anthropic call complete: provider=anthropic model=${this.backgroundModel} context=npc_conversation npcIds=${rel.sourceNpcId}/${rel.targetNpcId} duration=${convCallDuration}ms success=true`);

            const text = response.content.find((b) => b.type === 'text');
            if (!text || text.type !== 'text') {
                return null;
            }

            const parsed = JSON.parse(text.text) as {
                relationshipChange?: { type: NpcRelationshipType; description: string } | null
                itemExchanged?: { npcItemId: number; toNpcId: number } | null
                newAgendaSource?: string | null
                newAgendaTarget?: string | null
                sharedMemories?: Array<{ receiverNpcId: number; content: string; senderNpcId: number }>
            };

            return {
                sourceNpcId: rel.sourceNpcId,
                targetNpcId: rel.targetNpcId,
                relationshipChange: parsed.relationshipChange ?? null,
                itemExchanged: parsed.itemExchanged ?? null,
                newAgendaSource: parsed.newAgendaSource ?? null,
                newAgendaTarget: parsed.newAgendaTarget ?? null,
                sharedMemories: parsed.sharedMemories ?? [],
            };
        } catch (error) {
            const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
            this.logger.error(`Anthropic call failed: provider=anthropic model=${this.backgroundModel} context=npc_conversation npcIds=${rel.sourceNpcId}/${rel.targetNpcId} errorClass=${errorClass}`);
            return null;
        }
    }

    /**
     * Applies all tick outcomes atomically in a single EntityManager flush.
     * Includes NPC field updates, WorldEvent rows, and NpcRelationship changes.
     */
    async applyOutcomes(batch: TickOutcomeBatch, dueNpcs: Npc[]): Promise<void> {
        const npcMap = new Map(dueNpcs.map((npc) => [npc.id, npc]));

        // Apply agenda outcomes
        for (const outcome of batch.agendaOutcomes) {
            const npc = npcMap.get(outcome.npcId);
            if (!npc) {
                continue;
            }

            npc.agenda = outcome.agenda;
            npc.nextTickInGameDay = outcome.nextTickInGameDay;

            if (outcome.newLocationId !== null) {
                npc.currentLocationId = outcome.newLocationId ?? null;
            }
        }

        // Create departure WorldEvent rows
        for (const event of batch.departureEvents) {
            this.em.create(WorldEvent, {
                campaignId: event.campaignId,
                locationId: event.locationId,
                description: event.description,
                source: WorldEventSource.WORLD_TICK,
                status: WorldEventStatus.ACTIVE,
            });
        }

        // Apply conversation outcomes
        const conversedAt = new Date();
        for (const conv of batch.conversationOutcomes) {
            const [sourceNpc, targetNpc] = await Promise.all([
                this.em.findOne(Npc, { id: conv.sourceNpcId }),
                this.em.findOne(Npc, { id: conv.targetNpcId }),
            ]);

            if (sourceNpc) {
                sourceNpc.lastConversedAt = conversedAt;
                if (conv.newAgendaSource) {
                    sourceNpc.agenda = conv.newAgendaSource;
                }
            }

            if (targetNpc) {
                targetNpc.lastConversedAt = conversedAt;
                if (conv.newAgendaTarget) {
                    targetNpc.agenda = conv.newAgendaTarget;
                }
            }

            if (conv.relationshipChange) {
                const rel = await this.em.findOne(NpcRelationship, {
                    sourceNpcId: conv.sourceNpcId,
                    targetNpcId: conv.targetNpcId,
                });
                if (rel) {
                    rel.type = conv.relationshipChange.type;
                    rel.description = conv.relationshipChange.description;
                }
            }

            if (conv.itemExchanged) {
                const item = await this.em.findOne(NpcItem, { id: conv.itemExchanged.npcItemId });
                if (item) {
                    item.npcId = conv.itemExchanged.toNpcId;
                }
            }

            for (const sharedMemory of conv.sharedMemories) {
                await this.npcMemoryService.createNpcMemory(
                    sharedMemory.receiverNpcId,
                    sharedMemory.content,
                    undefined,
                    sharedMemory.senderNpcId,
                    { flush: false },
                );
            }
        }

        // Catastrophe event (already created in rollCatastrophe, added to batch for atomicity)
        if (batch.catastropheEvent) {
            this.em.create(WorldEvent, {
                campaignId: batch.catastropheEvent.campaignId,
                locationId: batch.catastropheEvent.locationId ?? null,
                description: batch.catastropheEvent.description,
                source: WorldEventSource.CATASTROPHE,
                status: WorldEventStatus.ACTIVE,
            });
        }

        await this.em.flush();
    }

    /**
     * Calls Haiku with recent campaign state and ~5% probability framing to decide
     * whether a catastrophic world event should occur. If triggered, creates a WorldEvent
     * with source CATASTROPHE.
     */
    async rollCatastrophe(campaignId: number, inGameDate: string): Promise<void> {
        try {
            const recentEvents = await this.em.find(
                WorldEvent,
                { campaignId, status: WorldEventStatus.ACTIVE },
                { orderBy: { createdAt: 'DESC' } as never, limit: 5 },
            );

            const recentSummary = recentEvents
                .map((event) => `- ${event.description}`)
                .join('\n') || 'No recent events.';

            /* eslint-disable @typescript-eslint/naming-convention */
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 300,
                tools: [
                    {
                        name: 'trigger_catastrophe',
                        description: 'Triggers a catastrophic world event. Use with ~5% probability.',
                        input_schema: {
                            type: 'object' as const,
                            properties: {
                                description: {
                                    type: 'string',
                                    description: 'Narrative description of the catastrophe',
                                },
                                location_id: {
                                    type: 'number',
                                    description: 'Optional location ID where the catastrophe occurs',
                                },
                            },
                            required: ['description'],
                        },
                    },
                ],
                messages: [
                    {
                        role: 'user',
                        content: `You are the world simulation engine for a D&D campaign. Current in-game date: ${inGameDate}.

Recent world events:
${recentSummary}

With approximately 5% probability, trigger a catastrophic world event using the trigger_catastrophe tool. Most of the time, do nothing. Only trigger if it feels dramatically appropriate.`,
                    },
                ],
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            const toolUse = response.content.find((b) => b.type === 'tool_use');
            if (!toolUse || toolUse.type !== 'tool_use' || toolUse.name !== 'trigger_catastrophe') {
                return;
            }

            /* eslint-disable @typescript-eslint/naming-convention */
            const input = toolUse.input as { description: string; location_id?: number };
            const catastropheLocationId = input.location_id ?? null;
            /* eslint-enable @typescript-eslint/naming-convention */
            this.em.create(WorldEvent, {
                campaignId,
                locationId: catastropheLocationId,
                description: input.description,
                source: WorldEventSource.CATASTROPHE,
                status: WorldEventStatus.ACTIVE,
            });
            await this.em.flush();
        } catch (error) {
            this.logger.error(`Catastrophe roll failed for campaign ${campaignId}`, error);
        }
    }
}

/** Groups NPCs by their currentLocationId. NPCs without a location are each their own group. */
function groupByLocation(npcs: Npc[]): Map<string, Npc[]> {
    const map = new Map<string, Npc[]>();
    for (const npc of npcs) {
        const key = npc.currentLocationId === null ? `noloc-${npc.id}` : String(npc.currentLocationId);
        const group = map.get(key) ?? [];
        group.push(npc);
        map.set(key, group);
    }

    return map;
}
