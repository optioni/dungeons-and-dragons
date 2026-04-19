import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, OnModuleInit } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { ToolRegistry } from '../llm/tool-registry.service.js';
import { type ToolResult } from '../llm/tool-registry.js';
import { SubjectType } from '../memory/entities/memory.entity.js';
import { MemoryService } from '../memory/memory.service.js';
import { CombatService } from './combat.service.js';
import { DiceChecksService } from './dice-checks.service.js';
import { DiceService } from './dice.service.js';
import { ItemService } from './item.service.js';
import { LevelingService } from './leveling.service.js';
import { RestService } from './rest.service.js';
import { TravelService } from './travel.service.js';
import { WorldMutationService } from './world-mutation.service.js';
import { type CreateQuestDto, type ObjectiveSpec, QuestService } from '../quest/quest.service.js';
import { QuestObjectiveStatus, QuestObjectiveType } from '../quest/quest.enums.js';

interface SessionCtx {
    campaignId: number;
    characterId: number;
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

    private async loadCtx(sessionId: number): Promise<SessionCtx | null> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['campaign' as never] });
        if (!session) return null;
        const campaignId = session.campaign.id;
        const character = await this.em.findOne(Character, { campaign: { id: campaignId } } as never);
        if (!character) return null;
        return { campaignId, characterId: character.id };
    }

    private num(v: unknown): number {
        return typeof v === 'number' ? v : Number(v);
    }

    private str(v: unknown): string {
        return typeof v === 'string' ? v : String(v);
    }

    private registerDiceTools(): void {
        const { toolRegistry, dice, diceService } = this;

        toolRegistry.register({
            toolName: 'roll_dice',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = diceService.roll(this.str(input.expression));
                if (!result.success) return result;
                return { success: true, data: { total: result.total, rolls: result.rolls, expression: result.expression } };
            },
        });

        toolRegistry.register({
            toolName: 'check_skill',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return dice.checkSkill(this.num(input.character_id), this.str(input.skill), this.num(input.dc));
            },
        });

        toolRegistry.register({
            toolName: 'check_ability',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return dice.checkAbility(this.num(input.character_id), this.str(input.ability) as never, this.num(input.dc));
            },
        });
    }

    private registerCombatTools(): void {
        const { toolRegistry, combat } = this;

        toolRegistry.register({
            toolName: 'start_combat',
            execute: async (sessionId, input): Promise<ToolResult> => {
                return combat.startCombat(sessionId, (input.participants as never[]) ?? []);
            },
        });

        toolRegistry.register({
            toolName: 'advance_initiative',
            execute: async (sessionId): Promise<ToolResult> => combat.advanceInitiative(sessionId),
        });

        toolRegistry.register({
            toolName: 'apply_damage',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const result = await combat.applyDamage(sessionId, this.str(input.target_id), this.num(input.amount), this.str(input.damage_type));
                if (!result.success) return result;
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return result;
                return this.runQuestAutoChecker(ctx.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'heal',
            execute: async (sessionId, input): Promise<ToolResult> => {
                return combat.heal(sessionId, this.str(input.target_id), this.num(input.amount));
            },
        });

        toolRegistry.register({
            toolName: 'apply_condition',
            execute: async (sessionId, input): Promise<ToolResult> => {
                return combat.applyCondition(sessionId, this.str(input.target_id), this.str(input.condition));
            },
        });

        toolRegistry.register({
            toolName: 'remove_condition',
            execute: async (sessionId, input): Promise<ToolResult> => {
                return combat.removeCondition(sessionId, this.str(input.target_id), this.str(input.condition));
            },
        });

        toolRegistry.register({
            toolName: 'roll_death_save',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return combat.rollDeathSave(this.num(input.character_id));
            },
        });

        toolRegistry.register({
            toolName: 'stabilise',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return combat.stabilise(this.num(input.character_id));
            },
        });

        toolRegistry.register({
            toolName: 'instant_death',
            execute: async (sessionId, input): Promise<ToolResult> => {
                return combat.instantDeath(sessionId, this.num(input.character_id));
            },
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
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return rest.takeShortRest(ctx.characterId, this.num(input.hit_dice_to_spend ?? 1));
            },
        });

        toolRegistry.register({
            toolName: 'take_long_rest',
            execute: async (sessionId): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

                // Capture inGameDate before the rest advances it
                const campaign = await this.em.findOne(Campaign, { id: ctx.campaignId });
                const inGameDate = campaign?.inGameDate ?? 'Day 1';

                const result = await rest.takeLongRest(ctx.characterId, ctx.campaignId);

                // Write diary entry synchronously so it exists before any world tick
                const events = await this.em.find(GameEvent, { session: sessionId });
                await memory.writeDiaryEntry(ctx.campaignId, inGameDate, events);

                return result;
            },
        });
    }

    private registerTravelTools(): void {
        const { toolRegistry, travel } = this;

        toolRegistry.register({
            toolName: 'travel_to',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                const result = await travel.travelTo(ctx.campaignId, this.num(input.location_id));
                if (!result.success) return result;
                return this.runQuestAutoChecker(ctx.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'discover_location',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return travel.discoverLocation(
                    ctx.campaignId,
                    this.num(input.location_id),
                    this.str(input.source),
                    input.source_id !== undefined ? this.num(input.source_id) : null,
                );
            },
        });

        toolRegistry.register({
            toolName: 'create_location',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return travel.createLocation(ctx.campaignId, {
                    name: this.str(input.name),
                    description: this.str(input.description),
                    currentState: input.current_state !== undefined ? this.str(input.current_state) : null,
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
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return items.createItem(ctx.campaignId, {
                    name: this.str(input.name),
                    description: this.str(input.description),
                    itemType: this.str(input.item_type),
                    weight: input.weight !== undefined ? this.num(input.weight) : null,
                    value: input.value !== undefined ? this.num(input.value) : null,
                    srdEquipmentId: input.srd_equipment_id !== undefined ? this.num(input.srd_equipment_id) : null,
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
                    input.to_character_id !== undefined ? this.num(input.to_character_id) : undefined,
                    input.to_npc_id !== undefined ? this.num(input.to_npc_id) : undefined,
                );
                if (!result.success) return result;
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return result;
                return this.runQuestAutoChecker(ctx.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'equip_item',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return items.equipItem(this.num(input.character_item_id), this.str(input.slot));
            },
        });

        toolRegistry.register({
            toolName: 'unequip_item',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return items.unequipItem(this.num(input.character_item_id));
            },
        });

        toolRegistry.register({
            toolName: 'buy_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return items.buyItem(characterId, this.num(input.npc_id), this.num(input.item_id), this.num(input.quantity ?? 1));
            },
        });

        toolRegistry.register({
            toolName: 'sell_item',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return items.sellItem(characterId, this.num(input.npc_id), this.num(input.item_id), this.num(input.quantity ?? 1));
            },
        });

        toolRegistry.register({
            toolName: 'restock_merchant',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return items.restockMerchant(
                    this.num(input.npc_id),
                    Array.isArray(input.items) ? input.items as Array<{ itemId: number; quantity: number; priceInGold: number }> : [],
                );
            },
        });
    }

    private registerLevelingTools(): void {
        const { toolRegistry, leveling } = this;

        toolRegistry.register({
            toolName: 'trigger_level_up',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return leveling.triggerLevelUp(sessionId, characterId);
            },
        });

        toolRegistry.register({
            toolName: 'apply_level_up',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return leveling.applyLevelUp(
                    sessionId,
                    characterId,
                    {
                        abilityScoreImprovements: input.ability_score_improvements as never,
                        feat: input.feat !== undefined ? this.str(input.feat) : undefined,
                    },
                    this.num(input.hit_points_rolled ?? 0),
                );
            },
        });

        toolRegistry.register({
            toolName: 'use_spell_slot',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return leveling.useSpellSlot(characterId, this.num(input.level));
            },
        });

        toolRegistry.register({
            toolName: 'prepare_spells',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const characterId = input.character_id !== undefined
                    ? this.num(input.character_id)
                    : (await this.loadCtx(sessionId))?.characterId;
                if (!characterId) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
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
                if (!result.success) return result;
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return result;
                return this.runQuestAutoChecker(ctx.campaignId, result);
            },
        });

        toolRegistry.register({
            toolName: 'add_to_party',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                return world.addToParty(this.num(input.npc_id), ctx?.campaignId ?? 0);
            },
        });

        toolRegistry.register({
            toolName: 'remove_from_party',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return world.removeFromParty(this.num(input.npc_id));
            },
        });

        toolRegistry.register({
            toolName: 'update_location_state',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return world.updateLocationState(this.num(input.location_id), this.str(input.state));
            },
        });

        toolRegistry.register({
            toolName: 'shift_faction_disposition',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return world.shiftFactionDisposition(this.num(input.faction_id), this.str(input.disposition));
            },
        });

        toolRegistry.register({
            toolName: 'trigger_world_event',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return world.triggerWorldEvent(
                    ctx.campaignId,
                    this.str(input.description),
                    input.location_id !== undefined ? this.num(input.location_id) : null,
                    input.deadline_in_game_date !== undefined ? this.str(input.deadline_in_game_date) : null,
                    this.str(input.source ?? 'PLAYER_ACTION'),
                );
            },
        });

        toolRegistry.register({
            toolName: 'resolve_world_event',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                return world.resolveWorldEvent(this.num(input.world_event_id), this.str(input.outcome));
            },
        });

        toolRegistry.register({
            toolName: 'advance_antagonist_stage',
            execute: async (sessionId): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return world.advanceAntagonistStage(ctx.campaignId);
            },
        });

        toolRegistry.register({
            toolName: 'record_lore',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                return world.recordLore(ctx.campaignId, this.str(input.fact));
            },
        });
    }

    private registerQuestTools(): void {
        const { toolRegistry, questService } = this;

        toolRegistry.register({
            toolName: 'create_quest',
            execute: async (sessionId, input): Promise<ToolResult> => {
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

                const dto: CreateQuestDto = {
                    campaignId: ctx.campaignId,
                    title: this.str(input.title),
                    description: this.str(input.description),
                    agendaImpact: input.agenda_impact !== undefined ? this.str(input.agenda_impact) : null,
                    rewardNarrative: input.reward_narrative !== undefined ? this.str(input.reward_narrative) : null,
                    rewardXp: input.reward_xp !== undefined ? this.num(input.reward_xp) : null,
                    rewardGold: input.reward_gold !== undefined ? this.num(input.reward_gold) : null,
                    objectives: Array.isArray(input.objectives)
                        ? (input.objectives as Array<Record<string, unknown>>).map((o, i) => ({
                            description: this.str(o.description),
                            type: this.str(o.type) as QuestObjectiveType,
                            entityRef: o.entity_ref !== undefined ? this.str(o.entity_ref) : null,
                            entityId: o.entity_id !== undefined ? this.num(o.entity_id) : null,
                            order: o.order !== undefined ? this.num(o.order) : i,
                        } satisfies ObjectiveSpec))
                        : [],
                    npcs: Array.isArray(input.npcs)
                        ? (input.npcs as Array<Record<string, unknown>>).map((n) => ({
                            ref: this.str(n.ref),
                            name: this.str(n.name),
                            description: n.description !== undefined ? this.str(n.description) : null,
                            profession: n.profession !== undefined ? this.str(n.profession) : null,
                            disposition: n.disposition !== undefined ? this.str(n.disposition) : null,
                            agenda: n.agenda !== undefined ? this.str(n.agenda) : null,
                            currentLocationId: n.current_location_id !== undefined ? this.num(n.current_location_id) : null,
                        }))
                        : undefined,
                    locations: Array.isArray(input.locations)
                        ? (input.locations as Array<Record<string, unknown>>).map((l) => ({
                            ref: this.str(l.ref),
                            name: this.str(l.name),
                            description: this.str(l.description),
                            currentState: l.current_state !== undefined ? this.str(l.current_state) : null,
                            connectedLocationIds: Array.isArray(l.connected_location_ids) ? l.connected_location_ids as number[] : [],
                        }))
                        : undefined,
                    items: Array.isArray(input.items)
                        ? (input.items as Array<Record<string, unknown>>).map((i) => ({
                            ref: this.str(i.ref),
                            name: this.str(i.name),
                            description: this.str(i.description),
                            itemType: i.item_type !== undefined ? this.str(i.item_type) : null,
                            weight: i.weight !== undefined ? this.num(i.weight) : null,
                            value: i.value !== undefined ? this.num(i.value) : null,
                        }))
                        : undefined,
                    worldEvents: Array.isArray(input.world_events)
                        ? (input.world_events as Array<Record<string, unknown>>).map((e) => ({
                            ref: this.str(e.ref),
                            description: this.str(e.description),
                            locationId: e.location_id !== undefined ? this.num(e.location_id) : null,
                            deadlineInGameDate: e.deadline_in_game_date !== undefined ? this.str(e.deadline_in_game_date) : null,
                        }))
                        : undefined,
                };

                const result = await questService.createQuest(dto);
                if (!result.success) return { success: false, errorCode: 'QUEST_CREATE_FAILED', message: result.reason };
                return { success: true, data: { questId: (result.quest as unknown as { id: number }).id } };
            },
        });

        toolRegistry.register({
            toolName: 'complete_quest',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.completeQuest(this.num(input.quest_id));
                if (!result.success) return { success: false, errorCode: result.reason, message: result.reason };
                return { success: true, data: { questId: (result.quest as unknown as { id: number }).id, status: 'COMPLETED' } };
            },
        });

        toolRegistry.register({
            toolName: 'fail_quest',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.failQuest(this.num(input.quest_id));
                if (!result.success) return { success: false, errorCode: result.reason, message: result.reason };
                return { success: true, data: { questId: (result.quest as unknown as { id: number }).id, status: 'FAILED' } };
            },
        });

        toolRegistry.register({
            toolName: 'update_quest_objective',
            execute: async (_sessionId, input): Promise<ToolResult> => {
                const result = await questService.updateQuestObjective(
                    this.num(input.objective_id),
                    this.str(input.status) as QuestObjectiveStatus,
                );
                if (!result.success) return { success: false, errorCode: result.reason, message: result.reason };
                return { success: true, data: { objectiveId: (result.objective as unknown as { id: number }).id, status: result.objective.status } };
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
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                try {
                    const subjectId = input.subject_id !== undefined ? this.str(input.subject_id) : undefined;
                    const record = await memory.createMemory(
                        ctx.campaignId,
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
                const ctx = await this.loadCtx(sessionId);
                if (!ctx) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
                try {
                    const results = await memory.searchMemories(
                        ctx.campaignId,
                        this.str(input.query),
                        {
                            subjectType: input.subject_type !== undefined ? this.str(input.subject_type) as SubjectType : undefined,
                            subjectId: input.subject_id !== undefined ? this.str(input.subject_id) : undefined,
                            limit: input.limit !== undefined ? this.num(input.limit) : undefined,
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
