import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, OnModuleInit } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { type ToolResult } from '../llm/tool-registry.js';
import { ToolRegistry } from '../llm/tool-registry.service.js';
import { SubjectType } from '../memory/entities/memory.entity.js';
import { MemoryService } from '../memory/memory.service.js';
import { QuestObjectiveStatus, QuestObjectiveType } from '../quest/quest.enums.js';
import { type CreateQuestDto, type ObjectiveSpec, QuestService } from '../quest/quest.service.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { CombatService } from './combat.service.js';
import { DiceChecksService } from './dice-checks.service.js';
import { DiceService } from './dice.service.js';
import { ItemService } from './item.service.js';
import { LevelingService } from './leveling.service.js';
import { RestService } from './rest.service.js';
import { TravelService } from './travel.service.js';
import { WorldMutationService } from './world-mutation.service.js';

interface SessionContext {
    campaignId: number
    characterId: number
}

/** Registers all GameEngine tool handlers with the shared ToolRegistry in onModuleInit. */
@Injectable()
export class GameEngineToolRegistrar implements OnModuleInit {
    constructor(
        private readonly toolRegistry: ToolRegistry,
        private readonly em: EntityManager,
        private readonly dice: DiceChecksService,
        private readonly diceService: DiceService,
        private readonly combat: CombatService,
        private readonly rest: RestService,
        private readonly travel: TravelService,
        private readonly items: ItemService,
        private readonly leveling: LevelingService,
        private readonly world: WorldMutationService,
        private readonly memory: MemoryService,
        private readonly questService: QuestService,
    ) {}

    onModuleInit(): void {
        this.registerDiceTools();
        this.registerCombatTools();
        this.registerRestTools();
        this.registerTravelTools();
        this.registerItemTools();
        this.registerLevelingTools();
        this.registerWorldTools();
        this.registerMemoryTools();
        this.registerQuestTools();
    }

    private async loadCtx(sessionId: number): Promise<SessionContext | null> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['campaign' as never] });
        if (!session) {
            return null;
        }

        const campaignId = session.campaign.id;
        const character = await this.em.findOne(Character, { campaign: { id: campaignId } } as never);
        if (!character) {
            return null;
        }

        return { campaignId, characterId: character.id };
    }

    private num(value: unknown): number {
        return typeof value === 'number' ? value : Number(value);
    }

    private str(value: unknown): string {
        return typeof value === 'string' ? value : String(value);
    }

    private registerDiceTools(): void {
        const { toolRegistry, dice, diceService } = this;

        toolRegistry.register({
            toolName: 'roll_dice',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = diceService.roll(this.str(input.expression));
                if (!result.success) {
                    return result;
                }

                return {
                    success: true,
                    data: { total: result.total, rolls: result.rolls, expression: result.expression },
                };
            },
        });

        toolRegistry.register({
            toolName: 'check_skill',
            execute: async (_sessionId, input): Promise<ToolResult> => dice.checkSkill(
                this.num(input.character_id), this.str(input.skill), this.num(input.dc),
            ),
        });

        toolRegistry.register({
            toolName: 'check_ability',
            execute: async (_sessionId, input): Promise<ToolResult> => dice.checkAbility(
                this.num(input.character_id), this.str(input.ability) as never, this.num(input.dc),
            ),
        });
    }

    private registerCombatTools(): void {
        const { toolRegistry, combat } = this;

        toolRegistry.register({
            toolName: 'start_combat',
            execute: async (sessionId, input): Promise<ToolResult> => combat.startCombat(
                sessionId, (input.participants as never[]) ?? [],
            ),
        });

        toolRegistry.register({
            toolName: 'advance_initiative',
            execute: async (sessionId): Promise<ToolResult> => combat.advanceInitiative(sessionId),
        });

        toolRegistry.register({
            toolName: 'apply_damage',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const result = await combat.applyDamage(
                    sessionId, this.str(input.target_id), this.num(input.amount), this.str(input.damage_type),
                );
                if (!result.success) {
                    return result;
                }

                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return result;
                }

                return this.runQuestAutoChecker(context.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'heal',
            execute: async (sessionId, input): Promise<ToolResult> => combat.heal(
                sessionId, this.str(input.target_id), this.num(input.amount),
            ),
        });

        toolRegistry.register({
            toolName: 'apply_condition',
            execute: async (sessionId, input): Promise<ToolResult> => combat.applyCondition(
                sessionId, this.str(input.target_id), this.str(input.condition),
            ),
        });

        toolRegistry.register({
            toolName: 'remove_condition',
            execute: async (sessionId, input): Promise<ToolResult> => combat.removeCondition(
                sessionId, this.str(input.target_id), this.str(input.condition),
            ),
        });

        toolRegistry.register({
            toolName: 'roll_death_save',
            execute: async (_sessionId, input): Promise<ToolResult> => combat.rollDeathSave(
                this.num(input.character_id),
            ),
        });

        toolRegistry.register({
            toolName: 'stabilise',
            execute: async (_sessionId, input): Promise<ToolResult> => combat.stabilise(this.num(input.character_id)),
        });

        toolRegistry.register({
            toolName: 'instant_death',
            execute: async (sessionId, input): Promise<ToolResult> => combat.instantDeath(
                sessionId, this.num(input.character_id),
            ),
        });

        toolRegistry.register({
            toolName: 'end_combat',
            execute: async (sessionId): Promise<ToolResult> => combat.endCombat(sessionId),
        });
    }

    private registerRestTools(): void {
        const { toolRegistry, rest, memory } = this;

        toolRegistry.register({
            toolName: 'take_short_rest',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return rest.takeShortRest(context.characterId, this.num(input.hit_dice_to_spend ?? 1));
            },
        });

        toolRegistry.register({
            toolName: 'take_long_rest',
            execute: async (sessionId): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                // Capture inGameDate before the rest advances it
                const campaign = await this.em.findOne(Campaign, { id: context.campaignId });
                const inGameDate = campaign?.inGameDate ?? 'Day 1';

                const result = await rest.takeLongRest(context.characterId, context.campaignId);

                // Write diary entry synchronously so it exists before any world tick
                // eslint-disable-next-line unicorn/no-array-method-this-argument
                const events = await this.em.find(GameEvent, { session: sessionId });
                await memory.writeDiaryEntry(context.campaignId, inGameDate, events);

                return result;
            },
        });
    }

    private registerTravelTools(): void {
        const { toolRegistry, travel } = this;

        toolRegistry.register({
            toolName: 'travel_to',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                const result = await travel.travelTo(context.campaignId, this.num(input.location_id), sessionId);
                if (!result.success) {
                    return result;
                }

                return this.runQuestAutoChecker(context.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'update_campaign_settings',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                const settings: { travelEncounterEnabled?: boolean } = {};
                if (input.travel_encounter_enabled !== undefined) {
                    settings.travelEncounterEnabled = Boolean(input.travel_encounter_enabled);
                }

                return travel.updateCampaignSettings(context.campaignId, settings);
            },
        });

        toolRegistry.register({
            toolName: 'discover_location',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return travel.discoverLocation(
                    context.campaignId,
                    this.num(input.location_id),
                    this.str(input.source),
                    input.source_id === undefined ? null : this.num(input.source_id),
                );
            },
        });

        toolRegistry.register({
            toolName: 'create_location',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return travel.createLocation(context.campaignId, {
                    name: this.str(input.name),
                    description: this.str(input.description),
                    currentState: input.current_state === undefined ? null : this.str(input.current_state),
                    connectedLocationIds: Array.isArray(input.connected_location_ids)
                        ? (input.connected_location_ids as number[])
                        : [],
                });
            },
        });
    }

    private registerItemTools(): void {
        const { toolRegistry, items } = this;

        toolRegistry.register({
            toolName: 'create_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return items.createItem(context.campaignId, {
                    name: this.str(input.name),
                    description: this.str(input.description),
                    itemType: this.str(input.item_type),
                    weight: input.weight === undefined ? null : this.num(input.weight),
                    value: input.value === undefined ? null : this.num(input.value),
                    srdEquipmentId: input.srd_equipment_id === undefined ? null : this.num(input.srd_equipment_id),
                });
            },
        });

        toolRegistry.register({
            toolName: 'give_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const result = await items.giveItem(
                    sessionId,
                    this.num(input.item_id),
                    this.num(input.quantity ?? 1),
                    input.to_character_id === undefined ? undefined : this.num(input.to_character_id),
                    input.to_npc_id === undefined ? undefined : this.num(input.to_npc_id),
                );
                if (!result.success) {
                    return result;
                }

                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return result;
                }

                return this.runQuestAutoChecker(context.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'equip_item',
            execute: async (_sessionId, input): Promise<ToolResult> => items.equipItem(
                this.num(input.character_item_id), this.str(input.slot),
            ),
        });

        toolRegistry.register({
            toolName: 'unequip_item',
            execute: async (_sessionId, input): Promise<ToolResult> => items.unequipItem(
                this.num(input.character_item_id),
            ),
        });

        toolRegistry.register({
            toolName: 'buy_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return items.buyItem(
                    characterId, this.num(input.npc_id), this.num(input.item_id), this.num(input.quantity ?? 1),
                );
            },
        });

        toolRegistry.register({
            toolName: 'sell_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return items.sellItem(
                    characterId, this.num(input.npc_id), this.num(input.item_id), this.num(input.quantity ?? 1),
                );
            },
        });

        toolRegistry.register({
            toolName: 'restock_merchant',
            execute: async (_sessionId, input): Promise<ToolResult> => items.restockMerchant(
                this.num(input.npc_id),
                Array.isArray(input.items)
                    ? input.items as Array<{ itemId: number; quantity: number; priceInGold: number }>
                    : [],
            ),
        });
    }

    private registerLevelingTools(): void {
        const { toolRegistry, leveling } = this;

        toolRegistry.register({
            toolName: 'trigger_level_up',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return leveling.triggerLevelUp(sessionId, characterId);
            },
        });

        toolRegistry.register({
            toolName: 'apply_level_up',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return leveling.applyLevelUp(
                    sessionId,
                    characterId,
                    {
                        abilityScoreImprovements: input.ability_score_improvements as never,
                        feat: input.feat === undefined ? undefined : this.str(input.feat),
                    },
                    this.num(input.hit_points_rolled ?? 0),
                );
            },
        });

        toolRegistry.register({
            toolName: 'use_spell_slot',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return leveling.useSpellSlot(characterId, this.num(input.level));
            },
        });

        toolRegistry.register({
            toolName: 'prepare_spells',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id === undefined
                    ? (await this.loadCtx(sessionId))?.characterId
                    : this.num(input.character_id);
                if (!characterId) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return leveling.prepareSpells(characterId, Array.isArray(input.spells) ? input.spells as string[] : []);
            },
        });
    }

    private registerWorldTools(): void {
        const { toolRegistry, world } = this;

        toolRegistry.register({
            toolName: 'update_npc',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const result = await world.updateNpc(this.num(input.npc_id), input.updates as never);
                if (!result.success) {
                    return result;
                }

                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return result;
                }

                return this.runQuestAutoChecker(context.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'add_to_party',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                return world.addToParty(this.num(input.npc_id), context?.campaignId ?? 0);
            },
        });

        toolRegistry.register({
            toolName: 'remove_from_party',
            execute: async (_sessionId, input): Promise<ToolResult> => world.removeFromParty(this.num(input.npc_id)),
        });

        toolRegistry.register({
            toolName: 'update_location_state',
            execute: async (_sessionId, input): Promise<ToolResult> => world.updateLocationState(
                this.num(input.location_id), this.str(input.state),
            ),
        });

        toolRegistry.register({
            toolName: 'shift_faction_disposition',
            execute: async (_sessionId, input): Promise<ToolResult> => world.shiftFactionDisposition(
                this.num(input.faction_id), this.str(input.disposition),
            ),
        });

        toolRegistry.register({
            toolName: 'trigger_world_event',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return world.triggerWorldEvent(
                    context.campaignId,
                    this.str(input.description),
                    input.location_id === undefined ? null : this.num(input.location_id),
                    input.deadline_in_game_date === undefined ? null : this.str(input.deadline_in_game_date),
                    this.str(input.source ?? 'PLAYER_ACTION'),
                );
            },
        });

        toolRegistry.register({
            toolName: 'resolve_world_event',
            execute: async (_sessionId, input): Promise<ToolResult> => world.resolveWorldEvent(
                this.num(input.world_event_id), this.str(input.outcome),
            ),
        });

        toolRegistry.register({
            toolName: 'advance_antagonist_stage',
            execute: async (sessionId): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return world.advanceAntagonistStage(context.campaignId);
            },
        });

        toolRegistry.register({
            toolName: 'record_lore',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                return world.recordLore(context.campaignId, this.str(input.fact));
            },
        });
    }

    private registerQuestTools(): void {
        const { toolRegistry, questService } = this;

        toolRegistry.register({
            toolName: 'create_quest',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                const dto: CreateQuestDto = {
                    campaignId: context.campaignId,
                    title: this.str(input.title),
                    description: this.str(input.description),
                    agendaImpact: input.agenda_impact === undefined ? null : this.str(input.agenda_impact),
                    rewardNarrative: input.reward_narrative === undefined ? null : this.str(input.reward_narrative),
                    rewardXp: input.reward_xp === undefined ? null : this.num(input.reward_xp),
                    rewardGold: input.reward_gold === undefined ? null : this.num(input.reward_gold),
                    objectives: Array.isArray(input.objectives)
                        ? (input.objectives as Array<Record<string, unknown>>).map((objective, index) => ({
                            description: this.str(objective.description),
                            type: this.str(objective.type) as QuestObjectiveType,
                            entityRef: objective.entity_ref === undefined ? null : this.str(objective.entity_ref),
                            entityId: objective.entity_id === undefined ? null : this.num(objective.entity_id),
                            order: objective.order === undefined ? index : this.num(objective.order),
                        } satisfies ObjectiveSpec))
                        : [],
                    npcs: Array.isArray(input.npcs)
                        ? (input.npcs as Array<Record<string, unknown>>).map((npc) => ({
                            ref: this.str(npc.ref),
                            name: this.str(npc.name),
                            description: npc.description === undefined ? null : this.str(npc.description),
                            profession: npc.profession === undefined ? null : this.str(npc.profession),
                            disposition: npc.disposition === undefined ? null : this.str(npc.disposition),
                            agenda: npc.agenda === undefined ? null : this.str(npc.agenda),
                            currentLocationId: npc.current_location_id === undefined
                                ? null
                                : this.num(npc.current_location_id),
                        }))
                        : undefined,
                    locations: Array.isArray(input.locations)
                        ? (input.locations as Array<Record<string, unknown>>).map((location) => ({
                            ref: this.str(location.ref),
                            name: this.str(location.name),
                            description: this.str(location.description),
                            currentState: location.current_state === undefined
                                ? null
                                : this.str(location.current_state),
                            connectedLocationIds: Array.isArray(location.connected_location_ids)
                                ? location.connected_location_ids as number[]
                                : [],
                        }))
                        : undefined,
                    items: Array.isArray(input.items)
                        ? (input.items as Array<Record<string, unknown>>).map((item) => ({
                            ref: this.str(item.ref),
                            name: this.str(item.name),
                            description: this.str(item.description),
                            itemType: item.item_type === undefined ? null : this.str(item.item_type),
                            weight: item.weight === undefined ? null : this.num(item.weight),
                            value: item.value === undefined ? null : this.num(item.value),
                        }))
                        : undefined,
                    worldEvents: Array.isArray(input.world_events)
                        ? (input.world_events as Array<Record<string, unknown>>).map((worldEvent) => ({
                            ref: this.str(worldEvent.ref),
                            description: this.str(worldEvent.description),
                            locationId: worldEvent.location_id === undefined ? null : this.num(worldEvent.location_id),
                            deadlineInGameDate: worldEvent.deadline_in_game_date === undefined
                                ? null
                                : this.str(worldEvent.deadline_in_game_date),
                        }))
                        : undefined,
                };

                const result = await questService.createQuest(dto);
                if (!result.success) {
                    return { success: false, errorCode: 'QUEST_CREATE_FAILED', message: result.reason };
                }

                return { success: true, data: { questId: (result.quest as unknown as { id: number }).id } };
            },
        });

        toolRegistry.register({
            toolName: 'complete_quest',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.completeQuest(this.num(input.quest_id));
                if (!result.success) {
                    return { success: false, errorCode: result.reason, message: result.reason };
                }

                return {
                    success: true,
                    data: { questId: (result.quest as unknown as { id: number }).id, status: 'COMPLETED' },
                };
            },
        });

        toolRegistry.register({
            toolName: 'fail_quest',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.failQuest(this.num(input.quest_id));
                if (!result.success) {
                    return { success: false, errorCode: result.reason, message: result.reason };
                }

                return {
                    success: true,
                    data: { questId: (result.quest as unknown as { id: number }).id, status: 'FAILED' },
                };
            },
        });

        toolRegistry.register({
            toolName: 'update_quest_objective',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.updateQuestObjective(
                    this.num(input.objective_id),
                    this.str(input.status) as QuestObjectiveStatus,
                );
                if (!result.success) {
                    return { success: false, errorCode: result.reason, message: result.reason };
                }

                return {
                    success: true,
                    data: {
                        objectiveId: (result.objective as unknown as { id: number }).id,
                        status: result.objective.status,
                    },
                };
            },
        });
    }

    /** Runs the quest auto-checker and merges any questCompleted signal into the result. */
    private async runQuestAutoChecker(campaignId: number, result: ToolResult): Promise<ToolResult> {
        const checkerResult = await this.questService.runAutoChecker(campaignId);
        if (checkerResult.questCompleted) {
            return { ...result, questCompleted: checkerResult.questCompleted };
        }

        return result;
    }

    private registerMemoryTools(): void {
        const { toolRegistry, memory } = this;

        toolRegistry.register({
            toolName: 'record_memory',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                try {
                    const subjectId = input.subject_id === undefined ? undefined : this.str(input.subject_id);
                    const record = await memory.createMemory(
                        context.campaignId,
                        this.str(input.subject_type) as SubjectType,
                        this.str(input.content),
                        subjectId,
                    );
                    return { success: true, data: { id: record.id } };
                } catch (error) {
                    return {
                        success: false,
                        errorCode: 'MEMORY_CREATE_FAILED',
                        message: error instanceof Error ? error.message : String(error),
                    };
                }
            },
        });

        toolRegistry.register({
            toolName: 'search_memories',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const context = await this.loadCtx(sessionId);
                if (!context) {
                    return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                }

                try {
                    const results = await memory.searchMemories(
                        context.campaignId,
                        this.str(input.query),
                        {
                            subjectType: input.subject_type === undefined
                                ? undefined
                                : this.str(input.subject_type) as SubjectType,
                            subjectId: input.subject_id === undefined ? undefined : this.str(input.subject_id),
                            limit: input.limit === undefined ? undefined : this.num(input.limit),
                        },
                    );
                    return { success: true, data: { results } };
                } catch (error) {
                    return {
                        success: false,
                        errorCode: 'MEMORY_SEARCH_FAILED',
                        message: error instanceof Error ? error.message : String(error),
                    };
                }
            },
        });
    }
}
