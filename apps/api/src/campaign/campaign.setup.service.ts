import Anthropic from '@anthropic-ai/sdk';
import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository, MikroORM } from '@mikro-orm/postgresql';
import {
    BadRequestException, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Character } from '../character/entities/character.entity.js';
import { type EnvironmentConfig } from '../config/environment.validation.js';
import { Faction } from '../world/entities/faction.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { MapLocation } from '../world/entities/map-location.entity.js';
import { Map } from '../world/entities/map.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { NpcRelationship } from '../world/entities/npc-relationship.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { LocationDiscoverySource, NpcRelationshipType, WorldEventSource, WorldEventStatus } from '../world/world.enums.js';
import { CampaignSetupStatus } from './campaign.enums.js';
import { CampaignService } from './campaign.service.js';
import { type GenerateConceptsInput } from './dto/generate-concepts.input.js';
import { type GenerateWorldSeedInput } from './dto/generate-world-seed.input.js';
import { type SelectConceptInput } from './dto/select-concept.input.js';
import { type WorldSeedPayload } from './dto/world-seed.dto.js';
import { Campaign } from './entities/campaign.entity.js';

/** Injected at test time to stub Anthropic responses. */
export interface AnthropicClientLike {
    messages: {
        create: (parameters: Anthropic.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>
    }
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

        const hasAntagonist = seed.npcs.some((npc) => npc.isAntagonist);
        if (!hasAntagonist) {
            throw new BadRequestException('World seed validation failed: no NPC is marked as antagonist');
        }

        const hasAntagonistEvent = seed.worldEvents?.some((event) => event.isAntagonistEvent);
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

        const em = this.campaignRepo.getEntityManager();
        const character = await em.findOne(Character, { campaign: { id: campaignId } } as never, {
            populate: ['race', 'srdClass'] as never,
        });

        if (!character) {
            throw new BadRequestException({
                step: 'generate_concepts',
                code: 'NO_CHARACTER',
                message: 'A character must be created before generating story concepts',
            });
        }

        // Concept generation is one-time and quality-sensitive — use Sonnet
        const model = this.configService.getOrThrow<string>('LLM_DM_MODEL');

        let concepts: Campaign['generatedConcepts'];
        try {
            /* eslint-disable @typescript-eslint/naming-convention */
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
                            text: [
                                `Generate 3-4 distinct D&D 5e campaign story concepts for a ${input.tone.toLowerCase()} tone campaign with ${input.deathMode.toLowerCase().replace('_', ' ')} death rules.`,
                                '',
                                this.formatCharacterConceptContext(character),
                                '',
                                'Each concept should have a unique premise, central conflict, and hint at the type of antagonist. Make them varied in theme and scope, and make each concept feel specifically suited to this character rather than a generic campaign pitch.',
                            ].join('\n'),
                        },
                    ],
                }],
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            const toolUse = response.content.find((content) => content.type === 'tool_use');
            if (!toolUse || toolUse.type !== 'tool_use') {
                throw new Error('LLM did not call the expected tool');
            }

            const inputData = toolUse.input as { concepts: Campaign['generatedConcepts'] };
            concepts = inputData.concepts;
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

    private formatCharacterConceptContext(character: Character): string {
        const personalityLines = [
            character.personalityTraits.length > 0
                ? `Personality traits: ${character.personalityTraits.join('; ')}`
                : null,
            character.ideals.length > 0 ? `Ideals: ${character.ideals.join('; ')}` : null,
            character.bonds.length > 0 ? `Bonds: ${character.bonds.join('; ')}` : null,
            character.flaws.length > 0 ? `Flaws: ${character.flaws.join('; ')}` : null,
        ].filter((line): line is string => line !== null);

        return [
            'Player character:',
            `Name: ${character.name}`,
            `Race: ${character.race.name}`,
            `Class: ${character.srdClass.name}`,
            `Level: ${character.level}`,
            ...(personalityLines.length > 0 ? personalityLines : ['No explicit personality details recorded.']),
        ].join('\n');
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

        // World seed is quality-critical and one-time — use Sonnet, not Haiku
        const model = this.configService.getOrThrow<string>('LLM_DM_MODEL');

        const maxAttempts = 3;
        let seed: WorldSeedPayload | undefined;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const candidate = await this.callLlmForWorldSeed(model, campaign);
                this.validateWorldSeedPayload(candidate);
                seed = candidate;
                break;
            } catch (error) {
                lastError = error;
                if (error instanceof BadRequestException) {
                    this.logger.warn(`World seed validation failed on attempt ${attempt}/${maxAttempts}: ${(error as BadRequestException).message}`);
                } else {
                    this.logger.error(`World seed LLM call failed on attempt ${attempt}/${maxAttempts}`, error);
                }
            }
        }

        if (!seed) {
            // Campaign status is NOT advanced — setup remains resumable
            const isValidationError = lastError instanceof BadRequestException;
            throw new BadRequestException({
                step: 'generate_world_seed',
                code: isValidationError ? 'VALIDATION_FAILED' : 'LLM_ERROR',
                message: isValidationError
                    ? `World seed generation produced invalid data after ${maxAttempts} attempts. Please try again.`
                    : 'World seed generation failed. Please try again.',
            });
        }

        // Persist atomically
        await this.persistWorldSeed(campaign, seed);

        return campaign;
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    private async callLlmForWorldSeed(model: string, campaign: Campaign): Promise<WorldSeedPayload> {
        const concept = campaign.selectedConcept!;

        /* eslint-disable @typescript-eslint/naming-convention */
        const response = await this.anthropic.messages.create({
            model,
            max_tokens: 16_384,
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
                        'loreDocument',
                        'inGameDate',
                        'startingLocationIndex',
                        'openingSceneSeed',
                        'antagonistPlanState',
                        'locations',
                        'maps',
                        'factions',
                        'npcs',
                        'worldEvents',
                    ],
                },
            }],
            tool_choice: { type: 'tool', name: 'set_world_seed' },
            messages: [{
                role: 'user',
                content: [{
                    type: 'text',
                    text: [
                        'Generate a complete D&D 5e campaign world seed for the following story concept:',
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
        /* eslint-enable @typescript-eslint/naming-convention */

        const toolUse = response.content.find((content) => content.type === 'tool_use');
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
            const locations = seed.locations.map((loc) => em.create(Location, {
                campaignId: campaign.id,
                name: loc.name,
                description: loc.description,
                currentState: loc.currentState ?? null,
                coordinates: loc.coordinates ?? null,
                // populated after IDs are known
                connectedLocationIds: [] as number[],
                recentEvents: [],
            }));

            const maps = seed.maps.map((mapSeed) => em.create(Map, {
                campaignId: campaign.id,
                name: mapSeed.name,
                description: mapSeed.description ?? null,
                scale: mapSeed.scale ?? null,
            }));

            // locations and maps now have IDs
            await em.flush();

            // Resolve connected location IDs now that we have real IDs
            for (const [locationIndex, loc] of seed.locations.entries()) {
                const location = locations[locationIndex]!;
                location.connectedLocationIds = (loc.connectedLocationIndexes ?? [])
                    .map((connIndex) => locations[connIndex]?.id)
                    .filter((id): id is number => id !== undefined);
            }

            // Stage 2: Map-location join rows
            for (const [mapIndex, mapSeed] of seed.maps.entries()) {
                for (const locIndex of mapSeed.locationIndexes) {
                    const map = maps[mapIndex];
                    const location = locations[locIndex];
                    if (map && location) {
                        em.create(MapLocation, { mapId: map.id, locationId: location.id });
                    }
                }
            }

            // Stage 3: Factions
            for (const faction of seed.factions) {
                em.create(Faction, {
                    campaignId: campaign.id,
                    name: faction.name,
                    goals: faction.goals ?? null,
                    powerLevel: faction.powerLevel ?? null,
                    playerDisposition: faction.playerDisposition ?? null,
                    territory: faction.territory ?? null,
                });
            }

            // Stage 4: Create and flush NPCs to get IDs for relationships
            const npcs = seed.npcs.map((npcSeed) => em.create(Npc, {
                campaignId: campaign.id,
                name: npcSeed.name,
                description: npcSeed.description ?? null,
                profession: npcSeed.profession ?? null,
                coreMotivation: npcSeed.coreMotivation ?? null,
                personalityTraits: npcSeed.personalityTraits ?? [],
                speechStyle: npcSeed.speechStyle ?? null,
                disposition: npcSeed.disposition ?? null,
                currentLocationId: npcSeed.currentLocationIndex !== null && npcSeed.currentLocationIndex !== undefined
                    ? (locations[npcSeed.currentLocationIndex]?.id ?? null)
                    : null,
                hp: npcSeed.hp ?? null,
                maxHp: npcSeed.maxHp ?? null,
                agenda: npcSeed.agenda ?? null,
            }));

            // NPCs now have IDs
            await em.flush();

            // Stage 5: NPC relationships
            for (const rel of (seed.npcRelationships ?? [])) {
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
            }

            // Stage 6: NPC items
            for (const item of (seed.npcItems ?? [])) {
                const npc = npcs[item.npcIndex];
                if (npc) {
                    em.create(NpcItem, {
                        npcId: npc.id,
                        name: item.name,
                        quantity: item.quantity ?? 1,
                        merchantPrice: item.merchantPrice ?? null,
                    });
                }
            }

            // Stage 7: World events
            const worldEvents = seed.worldEvents.map((worldEvent) => em.create(WorldEvent, {
                campaignId: campaign.id,
                description: worldEvent.description,
                locationId: worldEvent.locationIndex !== null && worldEvent.locationIndex !== undefined
                    ? (locations[worldEvent.locationIndex]?.id ?? null)
                    : null,
                deadlineInGameDate: worldEvent.deadlineInGameDate ?? null,
                source: WorldEventSource.SETUP,
                status: WorldEventStatus.ACTIVE,
            }));

            // Stage 8: Starting location discovery
            const startingLocation = locations[seed.startingLocationIndex] ?? locations[0]!;
            em.create(LocationDiscovery, {
                campaignId: campaign.id,
                locationId: startingLocation.id,
                source: LocationDiscoverySource.SETUP,
            });

            // Stage 9: Campaign pointer fields and advancement
            const antagonistNpc = npcs.find((_npc, npcIndex) => seed.npcs[npcIndex]?.isAntagonist) ?? null;
            const antagonistEvent = worldEvents.find(
                (_event, eventIndex) => seed.worldEvents[eventIndex]?.isAntagonistEvent,
            ) ?? null;

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
