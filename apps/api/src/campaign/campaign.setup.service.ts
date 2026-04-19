import Anthropic from '@anthropic-ai/sdk';
import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository, MikroORM } from '@mikro-orm/postgresql';
import {
    BadRequestException, Injectable, InternalServerErrorException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type EnvironmentConfig } from '../config/environment.validation.js';
import { Faction } from '../world/entities/faction.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { Map } from '../world/entities/map.entity.js';
import { MapLocation } from '../world/entities/map-location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { NpcRelationship } from '../world/entities/npc-relationship.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { LocationDiscoverySource, NpcRelationshipType, WorldEventSource, WorldEventStatus } from '../world/world.enums.js';
import { CampaignSetupStatus } from './campaign.enums.js';
import { type GenerateConceptsInput } from './dto/generate-concepts.input.js';
import { type SelectConceptInput } from './dto/select-concept.input.js';
import { type GenerateWorldSeedInput } from './dto/generate-world-seed.input.js';
import { type WorldSeedPayload } from './dto/world-seed.dto.js';
import { Campaign } from './entities/campaign.entity.js';
import { CampaignService } from './campaign.service.js';

/** Injected at test time to stub Anthropic responses. */
export interface AnthropicClientLike {
    messages: {
        create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
    };
}

/**
 * Orchestrates the three-step campaign setup flow: story concept generation,
 * concept selection, and world seed generation + persistence.
 *
 * All mutations return structured errors (BadRequestException) rather than raw exceptions
 * so the LLM and UI can recover gracefully without manual cleanup.
 */
@Injectable()
export class CampaignSetupService {
    private readonly logger = new Logger(CampaignSetupService.name);

    private readonly anthropic: AnthropicClientLike;

    constructor(
        private readonly campaignService: CampaignService,
        private readonly orm: MikroORM,
        @InjectRepository(Campaign)
        private readonly campaignRepo: EntityRepository<Campaign>,
        private readonly configService: ConfigService<EnvironmentConfig>,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
        });
    }

    /**
     * Validates that the LLM-generated world seed meets the minimum playable requirements.
     * @throws BadRequestException with a descriptive message if any constraint is violated.
     */
    validateWorldSeedPayload(seed: WorldSeedPayload): void {
        if (!seed.loreDocument?.trim()) {
            throw new BadRequestException('World seed validation failed: lore document is required');
        }

        if (!seed.openingSceneSeed?.narrativeHook?.trim()) {
            throw new BadRequestException('World seed validation failed: opening scene seed is required');
        }

        const locationCount = seed.locations?.length ?? 0;
        if (locationCount < 3 || locationCount > 5) {
            throw new BadRequestException(
                `World seed validation failed: expected 3-5 locations, got ${locationCount}`,
            );
        }

        if (seed.startingLocationIndex < 0 || seed.startingLocationIndex >= locationCount) {
            throw new BadRequestException(
                'World seed validation failed: startingLocationIndex is out of range',
            );
        }

        const factionCount = seed.factions?.length ?? 0;
        if (factionCount < 2 || factionCount > 3) {
            throw new BadRequestException(
                `World seed validation failed: expected 2-3 factions, got ${factionCount}`,
            );
        }

        const npcCount = seed.npcs?.length ?? 0;
        if (npcCount < 3 || npcCount > 5) {
            throw new BadRequestException(
                `World seed validation failed: expected 3-5 NPCs, got ${npcCount}`,
            );
        }

        const hasAntagonist = seed.npcs.some((n) => n.isAntagonist);
        if (!hasAntagonist) {
            throw new BadRequestException('World seed validation failed: no NPC is marked as antagonist');
        }

        const hasAntagonistEvent = seed.worldEvents?.some((e) => e.isAntagonistEvent);
        if (!hasAntagonistEvent) {
            throw new BadRequestException('World seed validation failed: no antagonist world event found');
        }
    }

    /**
     * Step 1: Generates 3-4 story concepts from the character's backstory and the chosen tone.
     * Requires the campaign to have an associated character.
     * @throws BadRequestException if status is wrong or campaign has no character.
     */
    async generateCampaignStoryConcepts(
        input: GenerateConceptsInput,
        userId: number,
    ): Promise<Campaign> {
        const campaignId = Number(input.campaignId);
        const campaign = await this.campaignService.verifyOwnership(campaignId, userId);

        // Idempotency: if concepts already generated and status is beyond DRAFT, return current state
        if (campaign.setupStatus === CampaignSetupStatus.CONCEPTS_GENERATED) {
            return campaign;
        }

        this.campaignService.assertStatus(campaign, [CampaignSetupStatus.DRAFT]);

        // Verify the campaign has an associated character
        const em = this.campaignRepo.getEntityManager();
        const characterCount = await em.count('Character' as never, { campaign: { id: campaignId } });

        if (characterCount === 0) {
            throw new BadRequestException({
                step: 'generate_concepts',
                code: 'NO_CHARACTER',
                message: 'A character must be created before generating story concepts',
            });
        }

        const model = this.configService.getOrThrow<string>('LLM_BACKGROUND_MODEL');

        let concepts: Campaign['generatedConcepts'];
        try {
            const response = await this.anthropic.messages.create({
                model,
                max_tokens: 1500,
                tools: [{
                    name: 'set_story_concepts',
                    description: 'Set the generated story concepts for the campaign',
                    input_schema: {
                        type: 'object' as const,
                        properties: {
                            concepts: {
                                type: 'array',
                                minItems: 3,
                                maxItems: 4,
                                items: {
                                    type: 'object',
                                    properties: {
                                        index: { type: 'number' },
                                        premise: { type: 'string' },
                                        centralConflict: { type: 'string' },
                                        antagonistHint: { type: 'string' },
                                    },
                                    required: ['index', 'premise', 'centralConflict', 'antagonistHint'],
                                },
                            },
                        },
                        required: ['concepts'],
                    },
                }],
                tool_choice: { type: 'tool', name: 'set_story_concepts' },
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Generate 3-4 distinct D&D 5e campaign story concepts for a ${input.tone.toLowerCase()} tone campaign with ${input.deathMode.toLowerCase().replace('_', ' ')} death rules. Each concept should have a unique premise, central conflict, and hint at the type of antagonist. Make them varied in theme and scope.`,
                        },
                    ],
                }],
            });

            const toolUse = response.content.find((c) => c.type === 'tool_use');
            if (!toolUse || toolUse.type !== 'tool_use') {
                throw new Error('LLM did not call the expected tool');
            }

            const input_data = toolUse.input as { concepts: Campaign['generatedConcepts'] };
            concepts = input_data.concepts;
        } catch (error) {
            this.logger.error('Story concept generation failed', error);
            throw new BadRequestException({
                step: 'generate_concepts',
                code: 'LLM_ERROR',
                message: 'Story concept generation failed. Please try again.',
            });
        }

        campaign.tone = input.tone;
        campaign.deathMode = input.deathMode;
        campaign.generatedConcepts = concepts;
        campaign.setupStatus = CampaignSetupStatus.CONCEPTS_GENERATED;

        await em.flush();

        return campaign;
    }

    /**
     * Step 2: Persists the player's chosen concept by index into the campaign's
     * generated concepts list.
     * @throws BadRequestException if the index is out of range or status is wrong.
     */
    async selectCampaignStoryConcept(
        input: SelectConceptInput,
        userId: number,
    ): Promise<Campaign> {
        const campaignId = Number(input.campaignId);
        const campaign = await this.campaignService.verifyOwnership(campaignId, userId);

        this.campaignService.assertStatus(campaign, [CampaignSetupStatus.CONCEPTS_GENERATED]);

        const concepts = campaign.generatedConcepts ?? [];
        if (input.conceptIndex < 0 || input.conceptIndex >= concepts.length) {
            throw new BadRequestException({
                step: 'select_concept',
                code: 'VALIDATION_FAILED',
                message: `Concept index ${input.conceptIndex} is not valid. Campaign has ${concepts.length} concepts (0-${concepts.length - 1}).`,
            });
        }

        campaign.selectedConcept = concepts[input.conceptIndex]!;

        const em = this.campaignRepo.getEntityManager();
        await em.flush();

        return campaign;
    }

    /**
     * Step 3: Generates the full world seed from the selected concept and persists all
     * world entities in a single transaction. Advances the campaign to READY_TO_PLAY.
     *
     * Idempotent: if the campaign is already READY_TO_PLAY, returns current state.
     * Transactional: if validation or persistence fails, no partial rows are committed.
     *
     * @throws BadRequestException if status is wrong or validation fails.
     */
    async generateCampaignWorldSeed(
        input: GenerateWorldSeedInput,
        userId: number,
    ): Promise<Campaign> {
        const campaignId = Number(input.campaignId);
        const campaign = await this.campaignService.verifyOwnership(campaignId, userId);

        // Idempotency: already seeded
        if (campaign.setupStatus === CampaignSetupStatus.READY_TO_PLAY) {
            return campaign;
        }

        this.campaignService.assertStatus(campaign, [CampaignSetupStatus.CONCEPTS_GENERATED]);

        if (!campaign.selectedConcept) {
            throw new BadRequestException({
                step: 'generate_world_seed',
                code: 'VALIDATION_FAILED',
                message: 'A story concept must be selected before generating the world seed',
            });
        }

        const model = this.configService.getOrThrow<string>('LLM_BACKGROUND_MODEL');

        let seed: WorldSeedPayload;
        try {
            seed = await this.callLlmForWorldSeed(model, campaign);
        } catch (error) {
            this.logger.error('World seed LLM generation failed', error);
            // Campaign status is NOT advanced — setup remains resumable
            throw new BadRequestException({
                step: 'generate_world_seed',
                code: 'LLM_ERROR',
                message: 'World seed generation failed. Please try again.',
            });
        }

        // Validate before touching the database
        this.validateWorldSeedPayload(seed);

        // Persist atomically
        await this.persistWorldSeed(campaign, seed);

        return campaign;
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    private async callLlmForWorldSeed(model: string, campaign: Campaign): Promise<WorldSeedPayload> {
        const concept = campaign.selectedConcept!;

        const response = await this.anthropic.messages.create({
            model,
            max_tokens: 4096,
            tools: [{
                name: 'set_world_seed',
                description: 'Set the complete world seed for the campaign',
                input_schema: {
                    type: 'object' as const,
                    properties: {
                        loreDocument: { type: 'string', description: 'Narrative world lore, 2-3 paragraphs' },
                        inGameDate: { type: 'string', description: 'Starting in-game date (e.g. "Day 1, Month of Frost, Year 1423")' },
                        startingLocationIndex: { type: 'number', description: 'Index into locations array for starting location' },
                        openingSceneSeed: {
                            type: 'object',
                            properties: {
                                narrativeHook: { type: 'string' },
                                locationDescription: { type: 'string' },
                                initialTension: { type: 'string' },
                            },
                            required: ['narrativeHook', 'locationDescription', 'initialTension'],
                        },
                        antagonistPlanState: {
                            type: 'object',
                            properties: {
                                currentStage: { type: 'string' },
                                stages: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            description: { type: 'string' },
                                            completed: { type: 'boolean' },
                                        },
                                        required: ['name', 'description', 'completed'],
                                    },
                                },
                            },
                            required: ['currentStage', 'stages'],
                        },
                        locations: {
                            type: 'array',
                            minItems: 3,
                            maxItems: 5,
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    currentState: { type: 'string' },
                                    coordinates: {
                                        type: 'object',
                                        properties: { x: { type: 'number' }, y: { type: 'number' } },
                                        required: ['x', 'y'],
                                    },
                                    connectedLocationIndexes: { type: 'array', items: { type: 'number' } },
                                },
                                required: ['name', 'description'],
                            },
                        },
                        maps: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    scale: { type: 'string' },
                                    locationIndexes: { type: 'array', items: { type: 'number' } },
                                },
                                required: ['name', 'locationIndexes'],
                            },
                        },
                        factions: {
                            type: 'array',
                            minItems: 2,
                            maxItems: 3,
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    goals: { type: 'string' },
                                    powerLevel: { type: 'number' },
                                    playerDisposition: { type: 'string' },
                                    territory: { type: 'string' },
                                },
                                required: ['name'],
                            },
                        },
                        npcs: {
                            type: 'array',
                            minItems: 3,
                            maxItems: 5,
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    profession: { type: 'string' },
                                    coreMotivation: { type: 'string' },
                                    personalityTraits: { type: 'array', items: { type: 'string' } },
                                    speechStyle: { type: 'string' },
                                    disposition: { type: 'string' },
                                    currentLocationIndex: { type: 'number' },
                                    hp: { type: 'number' },
                                    maxHp: { type: 'number' },
                                    agenda: { type: 'string' },
                                    isAntagonist: { type: 'boolean' },
                                },
                                required: ['name'],
                            },
                        },
                        npcRelationships: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    sourceIndex: { type: 'number' },
                                    targetIndex: { type: 'number' },
                                    type: { type: 'string' },
                                    description: { type: 'string' },
                                    disposition: { type: 'string' },
                                },
                                required: ['sourceIndex', 'targetIndex', 'type'],
                            },
                        },
                        npcItems: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    npcIndex: { type: 'number' },
                                    name: { type: 'string' },
                                    quantity: { type: 'number' },
                                    merchantPrice: { type: 'number' },
                                },
                                required: ['npcIndex', 'name'],
                            },
                        },
                        worldEvents: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string' },
                                    locationIndex: { type: 'number' },
                                    deadlineInGameDate: { type: 'string' },
                                    source: { type: 'string', enum: ['SETUP'] },
                                    isAntagonistEvent: { type: 'boolean' },
                                },
                                required: ['description', 'source'],
                            },
                        },
                    },
                    required: [
                        'loreDocument', 'inGameDate', 'startingLocationIndex',
                        'openingSceneSeed', 'antagonistPlanState',
                        'locations', 'maps', 'factions', 'npcs', 'worldEvents',
                    ],
                },
            }],
            tool_choice: { type: 'tool', name: 'set_world_seed' },
            messages: [{
                role: 'user',
                content: [{
                    type: 'text',
                    text: [
                        `Generate a complete D&D 5e campaign world seed for the following story concept:`,
                        `Premise: ${concept.premise}`,
                        `Central conflict: ${concept.centralConflict}`,
                        `Antagonist hint: ${concept.antagonistHint}`,
                        `Campaign tone: ${campaign.tone ?? 'HEROIC'}`,
                        `Death mode: ${campaign.deathMode ?? 'STANDARD'}`,
                        '',
                        'Create a cohesive starting world with 3-5 locations, 2-3 factions, 3-5 key NPCs (including the antagonist), and at least 1 active world event driven by the antagonist. The world should feel alive with threads already in motion.',
                    ].join('\n'),
                }],
            }],
        });

        const toolUse = response.content.find((c) => c.type === 'tool_use');
        if (!toolUse || toolUse.type !== 'tool_use') {
            throw new Error('LLM did not call the expected tool');
        }

        return toolUse.input as WorldSeedPayload;
    }

    /**
     * Persists the validated world seed in a single transaction.
     * Uses staged flushes within the transaction to resolve entity IDs for join tables.
     */
    private async persistWorldSeed(campaign: Campaign, seed: WorldSeedPayload): Promise<void> {
        await this.orm.em.transactional(async (em) => {
            // Stage 1: Create and flush locations + maps to get IDs
            const locations = seed.locations.map((loc) =>
                em.create(Location, {
                    campaignId: campaign.id,
                    name: loc.name,
                    description: loc.description,
                    currentState: loc.currentState ?? null,
                    coordinates: loc.coordinates ?? null,
                    connectedLocationIds: [] as number[], // populated after IDs are known
                    recentEvents: [],
                }),
            );

            const maps = seed.maps.map((m) =>
                em.create(Map, {
                    campaignId: campaign.id,
                    name: m.name,
                    description: m.description ?? null,
                    scale: m.scale ?? null,
                }),
            );

            await em.flush(); // locations and maps now have IDs

            // Resolve connected location IDs now that we have real IDs
            seed.locations.forEach((loc, idx) => {
                const location = locations[idx]!;
                location.connectedLocationIds = (loc.connectedLocationIndexes ?? [])
                    .map((i) => locations[i]?.id)
                    .filter((id): id is number => id !== undefined);
            });

            // Stage 2: Map-location join rows
            seed.maps.forEach((mapSeed, mapIdx) => {
                mapSeed.locationIndexes.forEach((locIdx) => {
                    const map = maps[mapIdx];
                    const location = locations[locIdx];
                    if (map && location) {
                        em.create(MapLocation, { mapId: map.id, locationId: location.id });
                    }
                });
            });

            // Stage 3: Factions
            seed.factions.forEach((f) => {
                em.create(Faction, {
                    campaignId: campaign.id,
                    name: f.name,
                    goals: f.goals ?? null,
                    powerLevel: f.powerLevel ?? null,
                    playerDisposition: f.playerDisposition ?? null,
                    territory: f.territory ?? null,
                });
            });

            // Stage 4: Create and flush NPCs to get IDs for relationships
            const npcs = seed.npcs.map((n) =>
                em.create(Npc, {
                    campaignId: campaign.id,
                    name: n.name,
                    description: n.description ?? null,
                    profession: n.profession ?? null,
                    coreMotivation: n.coreMotivation ?? null,
                    personalityTraits: n.personalityTraits ?? [],
                    speechStyle: n.speechStyle ?? null,
                    disposition: n.disposition ?? null,
                    currentLocationId: n.currentLocationIndex != null
                        ? (locations[n.currentLocationIndex]?.id ?? null)
                        : null,
                    hp: n.hp ?? null,
                    maxHp: n.maxHp ?? null,
                    agenda: n.agenda ?? null,
                }),
            );

            await em.flush(); // NPCs now have IDs

            // Stage 5: NPC relationships
            (seed.npcRelationships ?? []).forEach((rel) => {
                const source = npcs[rel.sourceIndex];
                const target = npcs[rel.targetIndex];
                if (source && target) {
                    em.create(NpcRelationship, {
                        sourceNpcId: source.id,
                        targetNpcId: target.id,
                        type: rel.type as NpcRelationshipType,
                        description: rel.description ?? null,
                        disposition: rel.disposition ?? null,
                    });
                }
            });

            // Stage 6: NPC items
            (seed.npcItems ?? []).forEach((item) => {
                const npc = npcs[item.npcIndex];
                if (npc) {
                    em.create(NpcItem, {
                        npcId: npc.id,
                        name: item.name,
                        quantity: item.quantity ?? 1,
                        merchantPrice: item.merchantPrice ?? null,
                    });
                }
            });

            // Stage 7: World events
            const worldEvents = seed.worldEvents.map((e) =>
                em.create(WorldEvent, {
                    campaignId: campaign.id,
                    description: e.description,
                    locationId: e.locationIndex != null
                        ? (locations[e.locationIndex]?.id ?? null)
                        : null,
                    deadlineInGameDate: e.deadlineInGameDate ?? null,
                    source: WorldEventSource.SETUP,
                    status: WorldEventStatus.ACTIVE,
                }),
            );

            // Stage 8: Starting location discovery
            const startingLocation = locations[seed.startingLocationIndex] ?? locations[0]!;
            em.create(LocationDiscovery, {
                campaignId: campaign.id,
                locationId: startingLocation.id,
                source: LocationDiscoverySource.SETUP,
            });

            // Stage 9: Campaign pointer fields and advancement
            const antagonistNpc = npcs.find((_, idx) => seed.npcs[idx]?.isAntagonist) ?? null;
            const antagonistEvent = worldEvents.find((_, idx) => seed.worldEvents[idx]?.isAntagonistEvent) ?? null;

            campaign.currentLocationId = startingLocation.id;
            campaign.antagonistNpcId = antagonistNpc?.id ?? null;
            campaign.antagonistPlanState = seed.antagonistPlanState;
            campaign.openingSceneSeed = seed.openingSceneSeed;
            campaign.loreDocument = seed.loreDocument;
            campaign.inGameDate = seed.inGameDate;
            campaign.inGameDay = 1;
            campaign.setupStatus = CampaignSetupStatus.READY_TO_PLAY;

            // Suppress unused warning — event is persisted via em.create above
            void antagonistEvent;

            await em.flush();
        });
    }
}
