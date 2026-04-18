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
});
