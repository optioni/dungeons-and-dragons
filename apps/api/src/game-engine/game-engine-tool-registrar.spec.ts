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
        const leveling = {
            gainXp: makeMock(),
            levelUp: makeMock(),
            allocateAbilityScores: makeMock(),
            useSpellSlot: makeMock(),
            prepareSpells: makeMock(),
        };
        const world = {
            updateNpc: makeMock(),
            addToParty: makeMock(),
            removeFromParty: makeMock(),
            updateLocationState: makeMock(),
            shiftFactionDisposition: makeMock(),
            triggerWorldEvent: makeMock(),
            resolveWorldEvent: makeMock(),
            triggerCatastrophe: makeMock(),
            advanceAntagonistStage: makeMock(),
            recordLore: makeMock(),
            setSceneType: makeMock(),
        };
        const memory = { writeDiaryEntry: makeMock(), createMemory: makeMock() };
        const questService = {
            createQuest: makeMock(),
            completeQuest: makeMock(),
            failQuest: makeMock(),
            updateQuestObjective: makeMock(),
            runAutoChecker: makeMock(),
        };

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
            { endCampaign: vi.fn().mockResolvedValue({ ended: true }) } as never,
            { publish: vi.fn() } as never,
            { exists: vi.fn().mockResolvedValue(0) } as never,
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
    let questService: {
        runAutoChecker: ReturnType<typeof vi.fn>
        createQuest: ReturnType<typeof vi.fn>
        completeQuest: ReturnType<typeof vi.fn>
        failQuest: ReturnType<typeof vi.fn>
        updateQuestObjective: ReturnType<typeof vi.fn>
    };

    beforeEach(() => {
        registry = new ToolRegistry();

        const session = { id: 1, campaign: { id: 10 } };
        const character = { id: 2, campaign: { id: 10 } };
        const em = {
            findOne: vi.fn().mockImplementation((entity: { name?: string }) => {
                const name = String(entity);
                if (name.includes('GameSession')) {
                    return Promise.resolve(session);
                }

                if (name.includes('Character')) {
                    return Promise.resolve(character);
                }

                if (name.includes('Campaign')) {
                    return Promise.resolve({ id: 10, inGameDate: 'Day 1' });
                }

                return Promise.resolve(null);
            }),
            find: vi.fn().mockResolvedValue([]),
            flush: vi.fn(),
        };

        const combat = {
            applyDamage: vi.fn().mockResolvedValue({ success: true, data: {} }),
            startCombat: makeMock(),
            advanceInitiative: makeMock(),
            heal: makeMock(),
            applyCondition: makeMock(),
            removeCondition: makeMock(),
            rollDeathSave: makeMock(),
            stabilise: makeMock(),
            instantDeath: makeMock(),
            endCombat: makeMock(),
        };
        const travel = {
            travelTo: vi.fn().mockResolvedValue({ success: true, data: {} }),
            discoverLocation: makeMock(),
            createLocation: makeMock(),
        };
        const items = {
            giveItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
            createItem: makeMock(),
            equipItem: makeMock(),
            unequipItem: makeMock(),
            buyItem: makeMock(),
            sellItem: makeMock(),
            restockMerchant: makeMock(),
        };
        const world = {
            updateNpc: vi.fn().mockResolvedValue({ success: true, data: {} }),
            addToParty: makeMock(),
            removeFromParty: makeMock(),
            updateLocationState: makeMock(),
            shiftFactionDisposition: makeMock(),
            triggerWorldEvent: makeMock(),
            resolveWorldEvent: makeMock(),
            triggerCatastrophe: makeMock(),
            advanceAntagonistStage: makeMock(),
            recordLore: makeMock(),
            setSceneType: makeMock(),
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
            {
                triggerLevelUp: makeMock(),
                applyLevelUp: makeMock(),
                useSpellSlot: makeMock(),
                prepareSpells: makeMock(),
            } as never,
            world as never,
            { writeDiaryEntry: makeMock(), createMemory: makeMock(), searchMemories: makeMock() } as never,
            questService as never,
            { endCampaign: vi.fn().mockResolvedValue({ ended: true }) } as never,
            { publish: vi.fn() } as never,
            { exists: vi.fn().mockResolvedValue(0) } as never,
        );
        registrar.onModuleInit();
    });

    it('merges questCompleted into travel_to result', async () => {
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handler.get('travel_to')!.execute(1, { location_id: 42 });
        /* eslint-enable @typescript-eslint/naming-convention */
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5, questTitle: 'Done Quest' } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into apply_damage result', async () => {
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handler.get('apply_damage')!.execute(1, { target_id: '1', amount: 5, damage_type: 'slashing' });
        /* eslint-enable @typescript-eslint/naming-convention */
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into give_item result', async () => {
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handler.get('give_item')!.execute(1, { item_id: 1, quantity: 1 });
        /* eslint-enable @typescript-eslint/naming-convention */
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });

    it('merges questCompleted into update_npc result', async () => {
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handler.get('update_npc')!.execute(1, { npc_id: 3, updates: {} });
        /* eslint-enable @typescript-eslint/naming-convention */
        expect(result).toMatchObject({ success: true, questCompleted: { questId: 5 } });
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });
});

describe('GameEngineToolRegistrar — update_campaign_settings', () => {
    let registry: ToolRegistry;
    let travel: {
        travelTo: ReturnType<typeof vi.fn>
        discoverLocation: ReturnType<typeof vi.fn>
        createLocation: ReturnType<typeof vi.fn>
        updateCampaignSettings: ReturnType<typeof vi.fn>
    };

    beforeEach(() => {
        registry = new ToolRegistry();

        const session = { id: 1, campaign: { id: 10 } };
        const character = { id: 2, campaign: { id: 10 } };
        const em = {
            findOne: vi.fn().mockImplementation((entity: { name?: string }) => {
                const name = String(entity);
                if (name.includes('GameSession')) {
                    return Promise.resolve(session);
                }

                if (name.includes('Character')) {
                    return Promise.resolve(character);
                }

                if (name.includes('Campaign')) {
                    return Promise.resolve({ id: 10 });
                }

                return Promise.resolve(null);
            }),
            find: vi.fn().mockResolvedValue([]),
            flush: vi.fn(),
        };

        travel = {
            travelTo: vi.fn().mockResolvedValue({ success: true, data: {} }),
            discoverLocation: makeMock(),
            createLocation: makeMock(),
            updateCampaignSettings: vi.fn().mockResolvedValue(
                { success: true, data: { travelEncounterEnabled: false } },
            ),
        };

        const registrar = new GameEngineToolRegistrar(
            registry,
            em as never,
            { checkSkill: makeMock(), checkAbility: makeMock() } as never,
            { roll: makeMock() } as never,
            {
                startCombat: makeMock(),
                advanceInitiative: makeMock(),
                heal: makeMock(),
                applyCondition: makeMock(),
                removeCondition: makeMock(),
                rollDeathSave: makeMock(),
                stabilise: makeMock(),
                instantDeath: makeMock(),
                endCombat: makeMock(),
                applyDamage: makeMock(),
            } as never,
            { takeShortRest: makeMock(), takeLongRest: makeMock() } as never,
            travel as never,
            {
                createItem: makeMock(),
                giveItem: makeMock(),
                equipItem: makeMock(),
                unequipItem: makeMock(),
                buyItem: makeMock(),
                sellItem: makeMock(),
                restockMerchant: makeMock(),
            } as never,
            {
                triggerLevelUp: makeMock(),
                applyLevelUp: makeMock(),
                useSpellSlot: makeMock(),
                prepareSpells: makeMock(),
            } as never,
            {
                updateNpc: makeMock(),
                addToParty: makeMock(),
                removeFromParty: makeMock(),
                updateLocationState: makeMock(),
                shiftFactionDisposition: makeMock(),
                triggerWorldEvent: makeMock(),
                resolveWorldEvent: makeMock(),
                triggerCatastrophe: makeMock(),
                advanceAntagonistStage: makeMock(),
                recordLore: makeMock(),
                setSceneType: makeMock(),
            } as never,
            {
                writeDiaryEntry: makeMock(),
                createMemory: makeMock(),
                searchMemories: makeMock(),
            } as never,
            {
                createQuest: makeMock(),
                completeQuest: makeMock(),
                failQuest: makeMock(),
                updateQuestObjective: makeMock(),
                runAutoChecker: vi.fn().mockResolvedValue({}),
            } as never,
            { endCampaign: vi.fn().mockResolvedValue({ ended: true }) } as never,
            { publish: vi.fn() } as never,
            { exists: vi.fn().mockResolvedValue(0) } as never,
        );
        registrar.onModuleInit();
    });

    it('sets travelEncounterEnabled: false when called with that setting', async () => {
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handler.get('update_campaign_settings')!.execute(1, { travel_encounter_enabled: false });
        /* eslint-enable @typescript-eslint/naming-convention */
        expect(result).toMatchObject({ success: true });
        expect(travel.updateCampaignSettings).toHaveBeenCalledWith(
            10,
            expect.objectContaining({ travelEncounterEnabled: false }),
        );
    });

    it('leaves campaign unchanged when called with empty payload', async () => {
        travel.updateCampaignSettings.mockResolvedValue({ success: true, data: { travelEncounterEnabled: true } });
        type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;
        const handler = registry['handlers'] as HandlerMap;
        const result = await handler.get('update_campaign_settings')!.execute(1, {});
        expect(result).toMatchObject({ success: true });
        expect(travel.updateCampaignSettings).toHaveBeenCalledWith(10, {});
    });
});

describe('GameEngineToolRegistrar — end_campaign tool', () => {
    type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;

    let registry: ToolRegistry;
    let campaignService: { endCampaign: ReturnType<typeof vi.fn> };
    let streamPublisher: { publish: ReturnType<typeof vi.fn> };
    let em: {
        findOne: ReturnType<typeof vi.fn>
        count: ReturnType<typeof vi.fn>
        find: ReturnType<typeof vi.fn>
        flush: ReturnType<typeof vi.fn>
    };

    const sessionId = 1;
    const campaignId = 10;
    const activeCampaign = { id: campaignId, status: 'ACTIVE', inGameDay: 5 };

    beforeEach(() => {
        registry = new ToolRegistry();

        em = {
            findOne: vi.fn().mockImplementation((_entity: unknown, filter: unknown) => {
                const f = filter as Record<string, unknown>;
                if (f['id'] === campaignId || (f as Record<string, unknown>)['campaign'] !== undefined) {
                    return Promise.resolve(activeCampaign);
                }

                return Promise.resolve(null);
            }),
            count: vi.fn().mockResolvedValue(3),
            find: vi.fn().mockResolvedValue([]),
            flush: vi.fn(),
        };

        campaignService = { endCampaign: vi.fn().mockResolvedValue({ ended: true }) };
        streamPublisher = { publish: vi.fn() };

        const registrar = new GameEngineToolRegistrar(
            registry,
            em as never,
            { checkSkill: makeMock(), checkAbility: makeMock() } as never,
            { roll: makeMock() } as never,
            {
                startCombat: makeMock(), advanceInitiative: makeMock(), heal: makeMock(),
                applyCondition: makeMock(), removeCondition: makeMock(), rollDeathSave: makeMock(),
                stabilise: makeMock(), instantDeath: makeMock(), endCombat: makeMock(), applyDamage: makeMock(),
            } as never,
            { takeShortRest: makeMock(), takeLongRest: makeMock() } as never,
            { travelTo: makeMock(), discoverLocation: makeMock(), createLocation: makeMock(), updateCampaignSettings: makeMock() } as never,
            {
                createItem: makeMock(), giveItem: makeMock(), equipItem: makeMock(),
                unequipItem: makeMock(), buyItem: makeMock(), sellItem: makeMock(), restockMerchant: makeMock(),
            } as never,
            { triggerLevelUp: makeMock(), applyLevelUp: makeMock(), useSpellSlot: makeMock(), prepareSpells: makeMock() } as never,
            {
                updateNpc: makeMock(), addToParty: makeMock(), removeFromParty: makeMock(),
                updateLocationState: makeMock(), shiftFactionDisposition: makeMock(),
                triggerWorldEvent: makeMock(), resolveWorldEvent: makeMock(), triggerCatastrophe: makeMock(),
                advanceAntagonistStage: makeMock(), recordLore: makeMock(), setSceneType: makeMock(),
            } as never,
            { writeDiaryEntry: makeMock(), createMemory: makeMock(), searchMemories: makeMock() } as never,
            {
                createQuest: makeMock(), completeQuest: makeMock(), failQuest: makeMock(),
                updateQuestObjective: makeMock(), runAutoChecker: vi.fn().mockResolvedValue({}),
            } as never,
            campaignService as never,
            streamPublisher as never,
            { exists: vi.fn().mockResolvedValue(0) } as never,
        );
        registrar.onModuleInit();
    });

    it('ends the campaign and emits CAMPAIGN_ENDED chunk on success', async () => {
        const handlers = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('end_campaign')!.execute(sessionId, {
            campaign_id: campaignId,
            reason: 'The party prevailed',
            epitaph: 'A legend is born.',
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(campaignService.endCampaign).toHaveBeenCalledWith(campaignId, 'The party prevailed', 'A legend is born.');
        expect(streamPublisher.publish).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ type: 'CAMPAIGN_ENDED' }),
        );
        expect(result).toMatchObject({ success: true, data: { campaignEnded: true, epitaph: 'A legend is born.' } });
    });

    it('returns structured error without calling endCampaign when campaign is already ENDED', async () => {
        const endedCampaign = { ...activeCampaign, status: 'ENDED' };
        em.findOne.mockResolvedValue(endedCampaign);

        const handlers = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('end_campaign')!.execute(sessionId, {
            campaign_id: campaignId,
            reason: 'duplicate',
            epitaph: 'ignored',
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(campaignService.endCampaign).not.toHaveBeenCalled();
        expect(streamPublisher.publish).not.toHaveBeenCalled();
        expect(result).toMatchObject({ success: false, errorCode: 'CAMPAIGN_ALREADY_ENDED' });
    });

    it('returns structured error when campaign is not found', async () => {
        em.findOne.mockResolvedValue(null);

        const handlers = registry['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('end_campaign')!.execute(sessionId, {
            campaign_id: 999,
            reason: 'gone',
            epitaph: 'nothing',
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(result).toMatchObject({ success: false, errorCode: 'CAMPAIGN_NOT_FOUND' });
        expect(campaignService.endCampaign).not.toHaveBeenCalled();
    });
});

describe('GameEngineToolRegistrar — permadeath auto-end', () => {
    type HandlerMap = Map<string, { execute: (id: number, input: Record<string, unknown>) => Promise<unknown> }>;

    const sessionId = 1;
    const campaignId = 10;

    function makeRegistrar(opts: {
        deathMode?: string
        rollDeathSaveResult?: unknown
        instantDeathResult?: unknown
        redisExists?: number
        campaignService?: { endCampaign: ReturnType<typeof vi.fn> }
        streamPublisher?: { publish: ReturnType<typeof vi.fn> }
    }) {
        const reg = new ToolRegistry();

        const permadeathCampaign = { id: campaignId, deathMode: opts.deathMode ?? 'PERMADEATH', inGameDay: 3, inGameDate: 'Day 3', status: 'ACTIVE' };
        const session = { id: sessionId, campaign: permadeathCampaign };

        const em = {
            findOne: vi.fn().mockImplementation((_entity: unknown, filter: unknown) => {
                const f = filter as Record<string, unknown>;
                if (typeof f['id'] === 'number' && f['id'] === sessionId) {
                    return Promise.resolve(session);
                }

                if ((f as Record<string, unknown>)['campaign'] !== undefined) {
                    return Promise.resolve({ id: 2, name: 'Hero', campaign: { id: campaignId } });
                }

                return Promise.resolve(permadeathCampaign);
            }),
            find: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
            flush: vi.fn(),
        };

        const combat = {
            rollDeathSave: vi.fn().mockResolvedValue(
                opts.rollDeathSaveResult ?? { success: true, data: { outcome: 'DEAD' } },
            ),
            instantDeath: vi.fn().mockResolvedValue(
                opts.instantDeathResult ?? { success: true, data: { isDead: true } },
            ),
            startCombat: makeMock(), advanceInitiative: makeMock(), heal: makeMock(),
            applyCondition: makeMock(), removeCondition: makeMock(), stabilise: makeMock(),
            endCombat: makeMock(), applyDamage: vi.fn().mockResolvedValue({ success: true, data: {} }),
        };

        const campaignService = opts.campaignService ?? { endCampaign: vi.fn().mockResolvedValue({ ended: true }) };
        const streamPublisher = opts.streamPublisher ?? { publish: vi.fn() };
        const redis = { exists: vi.fn().mockResolvedValue(opts.redisExists ?? 0) };

        const registrar = new GameEngineToolRegistrar(
            reg,
            em as never,
            { checkSkill: makeMock(), checkAbility: makeMock() } as never,
            { roll: makeMock() } as never,
            combat as never,
            { takeShortRest: makeMock(), takeLongRest: makeMock() } as never,
            { travelTo: makeMock(), discoverLocation: makeMock(), createLocation: makeMock(), updateCampaignSettings: makeMock() } as never,
            { createItem: makeMock(), giveItem: makeMock(), equipItem: makeMock(), unequipItem: makeMock(), buyItem: makeMock(), sellItem: makeMock(), restockMerchant: makeMock() } as never,
            { triggerLevelUp: makeMock(), applyLevelUp: makeMock(), useSpellSlot: makeMock(), prepareSpells: makeMock() } as never,
            { updateNpc: makeMock(), addToParty: makeMock(), removeFromParty: makeMock(), updateLocationState: makeMock(), shiftFactionDisposition: makeMock(), triggerWorldEvent: makeMock(), resolveWorldEvent: makeMock(), triggerCatastrophe: makeMock(), advanceAntagonistStage: makeMock(), recordLore: makeMock(), setSceneType: makeMock() } as never,
            { writeDiaryEntry: vi.fn().mockResolvedValue(undefined), createMemory: makeMock(), searchMemories: makeMock() } as never,
            { createQuest: makeMock(), completeQuest: makeMock(), failQuest: makeMock(), updateQuestObjective: makeMock(), runAutoChecker: vi.fn().mockResolvedValue({}) } as never,
            campaignService as never,
            streamPublisher as never,
            redis as never,
        );
        registrar.onModuleInit();

        return { reg, campaignService, streamPublisher, redis };
    }

    it('ends campaign via roll_death_save when PERMADEATH and outcome is DEAD', async () => {
        const { reg, campaignService, streamPublisher } = makeRegistrar({});
        const handlers = reg['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('roll_death_save')!.execute(sessionId, { character_id: 1 });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(campaignService.endCampaign).toHaveBeenCalled();
        expect(streamPublisher.publish).toHaveBeenCalledWith(sessionId, expect.objectContaining({ type: 'CAMPAIGN_ENDED' }));
        expect(result).toMatchObject({ success: true, data: { campaignEnded: true } });
    });

    it('does NOT end campaign via roll_death_save when STORY mode', async () => {
        const { reg, campaignService } = makeRegistrar({ deathMode: 'STORY' });
        const handlers = reg['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        await handlers.get('roll_death_save')!.execute(sessionId, { character_id: 1 });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(campaignService.endCampaign).not.toHaveBeenCalled();
    });

    it('ends campaign via instant_death when PERMADEATH', async () => {
        const { reg, campaignService, streamPublisher } = makeRegistrar({});
        const handlers = reg['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('instant_death')!.execute(sessionId, { character_id: 1 });
        /* eslint-enable @typescript-eslint/naming-convention */

        expect(campaignService.endCampaign).toHaveBeenCalled();
        expect(streamPublisher.publish).toHaveBeenCalledWith(sessionId, expect.objectContaining({ type: 'CAMPAIGN_ENDED' }));
        expect(result).toMatchObject({ success: true, data: { campaignEnded: true } });
    });

    it('defers permadeath sequence when campaign Redis lock is held', async () => {
        const { reg, campaignService, redis } = makeRegistrar({ redisExists: 1 });
        redis.exists.mockResolvedValueOnce(1).mockResolvedValue(0);

        const handlers = reg['handlers'] as HandlerMap;
        /* eslint-disable @typescript-eslint/naming-convention */
        const result = await handlers.get('roll_death_save')!.execute(sessionId, { character_id: 1 });
        /* eslint-enable @typescript-eslint/naming-convention */

        // The tool handler returns campaignEnded: true (deferred)
        expect(result).toMatchObject({ success: true, data: { campaignEnded: true } });
        // endCampaign is called asynchronously after lock releases — not yet when tool returns
        expect(campaignService.endCampaign).not.toHaveBeenCalled();
    });
});
