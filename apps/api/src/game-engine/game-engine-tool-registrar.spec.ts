// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { ToolRegistry } from '../llm/tool-registry.service';
import { GameEngineToolRegistrar } from './game-engine-tool-registrar.service';

function makeMock(): ReturnType<typeof vi.fn> {
    return vi.fn();
}

describe('GameEngineToolRegistrar — trigger_catastrophe exclusion', () => {
    let registry: ToolRegistry;
    let registrar: GameEngineToolRegistrar;

    beforeEach(() => {
        registry = new ToolRegistry();

        const em = { findOne: makeMock(), find: makeMock() };
        const dice = { rollAbility: makeMock() };
        const diceService = { roll: makeMock() };
        const combat = { initiateCombat: makeMock(), attackNpc: makeMock() };
        const rest = { takeShortRest: makeMock(), takeLongRest: makeMock() };
        const travel = { travelTo: makeMock(), discoverLocation: makeMock(), createLocation: makeMock() };
        const items = { pickUpItem: makeMock(), dropItem: makeMock(), useItem: makeMock(), giveItem: makeMock() };
        const leveling = { gainXp: makeMock(), levelUp: makeMock(), allocateAbilityScores: makeMock(), useSpellSlot: makeMock(), prepareSpells: makeMock() };
        const world = {
            updateNpc: makeMock(), addToParty: makeMock(), removeFromParty: makeMock(),
            updateLocationState: makeMock(), shiftFactionDisposition: makeMock(),
            triggerWorldEvent: makeMock(), resolveWorldEvent: makeMock(),
            triggerCatastrophe: makeMock(), advanceAntagonistStage: makeMock(),
            recordLore: makeMock(), setSceneType: makeMock(),
        };
        const memory = { writeDiaryEntry: makeMock(), createMemory: makeMock() };
        const questService = { createQuest: makeMock(), completeQuest: makeMock(), failQuest: makeMock(), updateQuestObjective: makeMock(), runAutoChecker: makeMock() };

        registrar = new GameEngineToolRegistrar(
            registry,
            em as never,
            dice as never,
            diceService as never,
            combat as never,
            rest as never,
            travel as never,
            items as never,
            leveling as never,
            world as never,
            memory as never,
            questService as never,
        );

        registrar.onModuleInit();
    });

    it('does not register trigger_catastrophe in the DM session ToolRegistry', () => {
        const handlers = registry['handlers'] as Map<string, unknown>;
        expect(handlers.has('trigger_catastrophe')).toBe(false);
    });

    it('registers other world tools that are available during DM session', () => {
        const handlers = registry['handlers'] as Map<string, unknown>;
        expect(handlers.has('trigger_world_event')).toBe(true);
        expect(handlers.has('resolve_world_event')).toBe(true);
        expect(handlers.has('update_npc')).toBe(true);
    });

    it('registers quest tools', () => {
        const handlers = registry['handlers'] as Map<string, unknown>;
        expect(handlers.has('create_quest')).toBe(true);
        expect(handlers.has('complete_quest')).toBe(true);
        expect(handlers.has('fail_quest')).toBe(true);
        expect(handlers.has('update_quest_objective')).toBe(true);
    });
});

describe('GameEngineToolRegistrar — auto-checker integration', () => {
    let registry: ToolRegistry;
    let questService: { runAutoChecker: ReturnType<typeof vi.fn>; createQuest: ReturnType<typeof vi.fn>; completeQuest: ReturnType<typeof vi.fn>; failQuest: ReturnType<typeof vi.fn>; updateQuestObjective: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        registry = new ToolRegistry();

        const session = { id: 1, campaign: { id: 10 } };
        const character = { id: 2, campaign: { id: 10 } };
        const em = {
            findOne: vi.fn().mockImplementation((entity: { name?: string }) => {
                const name = String(entity);
                if (name.includes('GameSession')) return Promise.resolve(session);
                if (name.includes('Character')) return Promise.resolve(character);
                if (name.includes('Campaign')) return Promise.resolve({ id: 10, inGameDate: 'Day 1' });
                return Promise.resolve(null);
            }),
            find: vi.fn().mockResolvedValue([]),
            flush: vi.fn(),
        };

        const combat = {
            applyDamage: vi.fn().mockResolvedValue({ success: true, data: {} }),
            startCombat: makeMock(), advanceInitiative: makeMock(), heal: makeMock(),
            applyCondition: makeMock(), removeCondition: makeMock(), rollDeathSave: makeMock(),
            stabilise: makeMock(), instantDeath: makeMock(), endCombat: makeMock(),
        };
        const travel = {
            travelTo: vi.fn().mockResolvedValue({ success: true, data: {} }),
            discoverLocation: makeMock(), createLocation: makeMock(),
        };
        const items = {
            giveItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
            createItem: makeMock(), equipItem: makeMock(), unequipItem: makeMock(),
            buyItem: makeMock(), sellItem: makeMock(), restockMerchant: makeMock(),
        };
        const world = {
            updateNpc: vi.fn().mockResolvedValue({ success: true, data: {} }),
            addToParty: makeMock(), removeFromParty: makeMock(), updateLocationState: makeMock(),
            shiftFactionDisposition: makeMock(), triggerWorldEvent: makeMock(), resolveWorldEvent: makeMock(),
            triggerCatastrophe: makeMock(), advanceAntagonistStage: makeMock(), recordLore: makeMock(), setSceneType: makeMock(),
        };

        questService = {
            runAutoChecker: vi.fn().mockResolvedValue({ questCompleted: { questId: 5, questTitle: 'Done Quest' } }),
            createQuest: makeMock(),
            completeQuest: makeMock(),
            failQuest: makeMock(),
            updateQuestObjective: makeMock(),
        };

        const registrar = new GameEngineToolRegistrar(
            registry,
            em as never,
            { checkSkill: makeMock(), checkAbility: makeMock() } as never,
            { roll: makeMock() } as never,
            combat as never,
            { takeShortRest: makeMock(), takeLongRest: makeMock() } as never,
            travel as never,
            items as never,
            { triggerLevelUp: makeMock(), applyLevelUp: makeMock(), useSpellSlot: makeMock(), prepareSpells: makeMock() } as never,
            world as never,
            { writeDiaryEntry: makeMock(), createMemory: makeMock(), searchMemories: makeMock() } as never,
            questService as never,
        );
        registrar.onModuleInit();
    });

    it('merges questCompleted into travel_to result', async () => {
        const handler = registry['handlers'] as Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const result = await handler.get('travel_to')!.execute(1, { location_id: 42 });
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5, questTitle: 'Done Quest' } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into apply_damage result', async () => {
        const handler = registry['handlers'] as Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const result = await handler.get('apply_damage')!.execute(1, { target_id: '1', amount: 5, damage_type: 'slashing' });
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into give_item result', async () => {
        const handler = registry['handlers'] as Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const result = await handler.get('give_item')!.execute(1, { item_id: 1, quantity: 1 });
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into update_npc result', async () => {
        const handler = registry['handlers'] as Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const result = await handler.get('update_npc')!.execute(1, { npc_id: 3, updates: {} });
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });
});
