// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { EventType, SceneType } from '../session/session.enums';
import { GameEvent } from '../session/entities/game-event.entity';
import { GameSession } from '../session/entities/game-session.entity';
import { ContextLoader } from './context-loader.service';
import { PromptModuleRegistry } from './prompt-module-registry.service';

function makeMockRepo(em: Record<string, ReturnType<typeof vi.fn>>): Record<string, unknown> {
    return { getEntityManager: vi.fn().mockReturnValue(em) };
}

function makeMockPromptRegistry(): Record<string, ReturnType<typeof vi.fn>> {
    return {
        getModule: vi.fn().mockReturnValue('## Scene Module: Exploration\nSome guidance text'),
    };
}

function makeMockMemoryService(entries: Array<{ inGameDate: string; content: string }> = []) {
    return {
        getRecentDiaryEntries: vi.fn().mockResolvedValue(entries),
    };
}

function makeEvent(overrides: Partial<GameEvent>): GameEvent {
    const e = new GameEvent();
    const session = Object.assign(new GameSession(), { id: 1 });
    Object.assign(e, { id: 1, session, eventType: EventType.PLAYER_INPUT, content: {}, createdAt: new Date(), ...overrides });
    return e;
}

describe('ContextLoader', () => {
    let em: Record<string, ReturnType<typeof vi.fn>>;
    let promptRegistry: ReturnType<typeof makeMockPromptRegistry>;
    let memoryService: ReturnType<typeof makeMockMemoryService>;
    let service: ContextLoader;

    beforeEach(() => {
        em = {
            findOneOrFail: vi.fn(),
            findOne: vi.fn(),
            find: vi.fn(),
        };
        promptRegistry = makeMockPromptRegistry();
        memoryService = makeMockMemoryService();
        const repo = makeMockRepo(em);
        service = new ContextLoader(
            repo as never,
            repo as never,
            repo as never,
            repo as never,
            repo as never,
            promptRegistry as never,
            memoryService as never,
        );
    });

    describe('loadBaseBlock', () => {
        it('includes the scene module text for the given scene type', () => {
            const result = service.loadBaseBlock(SceneType.EXPLORATION);

            expect(promptRegistry.getModule).toHaveBeenCalledWith(SceneType.EXPLORATION);
            expect(result).toContain('Dungeon Master');
            expect(result).toContain('## Scene Module: Exploration');
        });

        it('requests the correct module for COMBAT scene', () => {
            promptRegistry.getModule.mockReturnValueOnce('## Scene Module: Combat\nCombat guidance');
            const result = service.loadBaseBlock(SceneType.COMBAT);

            expect(promptRegistry.getModule).toHaveBeenCalledWith(SceneType.COMBAT);
            expect(result).toContain('## Scene Module: Combat');
        });
    });

    describe('loadCampaignBlock', () => {
        it('includes lore document and antagonist plan state', async () => {
            em.findOneOrFail.mockResolvedValue({
                id: 1,
                loreDocument: 'The world is dark and dangerous.',
                antagonistPlanState: { currentStage: 'Rising', stages: [] },
                inGameDate: 'Day 3',
            });

            const result = await service.loadCampaignBlock(1);

            expect(result).toContain('The world is dark and dangerous.');
            expect(result).toContain('Rising');
            expect(result).toContain('Day 3');
        });

        it('returns placeholder when no lore exists', async () => {
            em.findOneOrFail.mockResolvedValue({ id: 1, loreDocument: null, antagonistPlanState: null, inGameDate: null });

            const result = await service.loadCampaignBlock(1);

            expect(result).toContain('No lore document yet');
        });
    });

    describe('formatEventsAsMessages', () => {
        it('formats PLAYER_INPUT as user message', () => {
            const event = makeEvent({
                eventType: EventType.PLAYER_INPUT,
                content: { text: 'I attack the goblin' },
            });

            const messages = service.formatEventsAsMessages([event]);

            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content).toBe('I attack the goblin');
        });

        it('formats DM_NARRATIVE as assistant message', () => {
            const event = makeEvent({
                eventType: EventType.DM_NARRATIVE,
                content: { narrative: 'The goblin falls.' },
            });

            const messages = service.formatEventsAsMessages([event]);

            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('assistant');
            expect(messages[0].content).toBe('The goblin falls.');
        });

        it('formats TOOL_CALL as assistant tool_use + user tool_result pair', () => {
            const event = makeEvent({
                eventType: EventType.TOOL_CALL,
                content: {
                    toolUseId: 'tool_abc123',
                    toolName: 'set_scene_type',
                    toolInput: { scene_type: 'COMBAT' },
                    toolResult: { success: true },
                },
            });

            const messages = service.formatEventsAsMessages([event]);

            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe('assistant');
            expect(Array.isArray(messages[0].content)).toBe(true);
            const assistantContent = messages[0].content as Array<{ type: string; id: string; name: string }>;
            expect(assistantContent[0].type).toBe('tool_use');
            expect(assistantContent[0].id).toBe('tool_abc123');
            expect(assistantContent[0].name).toBe('set_scene_type');

            expect(messages[1].role).toBe('user');
            const userContent = messages[1].content as Array<{ type: string; tool_use_id: string }>;
            expect(userContent[0].type).toBe('tool_result');
            expect(userContent[0].tool_use_id).toBe('tool_abc123');
        });

        it('preserves chronological order of mixed event types', () => {
            const events = [
                makeEvent({ id: 1, eventType: EventType.PLAYER_INPUT, content: { text: 'Input 1' } }),
                makeEvent({ id: 2, eventType: EventType.DM_NARRATIVE, content: { narrative: 'Narrative 1' } }),
                makeEvent({ id: 3, eventType: EventType.PLAYER_INPUT, content: { text: 'Input 2' } }),
            ];

            const messages = service.formatEventsAsMessages(events);

            expect(messages).toHaveLength(3);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[2].role).toBe('user');
        });
    });

    describe('loadWorldBlock — diary entries at breakpoint 3', () => {
        it('includes diary entries in the world block when present', async () => {
            memoryService = makeMockMemoryService([
                { inGameDate: 'Day 2', content: 'The second day was eventful.' },
                { inGameDate: 'Day 1', content: 'The adventure began.' },
            ]);
            const repo = makeMockRepo(em);
            service = new ContextLoader(repo as never, repo as never, repo as never, repo as never, repo as never, promptRegistry as never, memoryService as never);

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('## Recent Diary');
            expect(result).toContain('Day 1');
            expect(result).toContain('The adventure began.');
        });

        it('omits diary section without error when no entries exist', async () => {
            memoryService = makeMockMemoryService([]);
            const repo = makeMockRepo(em);
            service = new ContextLoader(repo as never, repo as never, repo as never, repo as never, repo as never, promptRegistry as never, memoryService as never);

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Recent Diary');
        });

        it('produces different output when a new diary entry is added (breakpoint 3 rebuilds)', async () => {
            const repo = makeMockRepo(em);

            // First call: no entries
            memoryService = makeMockMemoryService([]);
            service = new ContextLoader(repo as never, repo as never, repo as never, repo as never, repo as never, promptRegistry as never, memoryService as never);
            const resultBefore = await service.loadWorldBlock(1);

            // Second call: new entry added
            memoryService = makeMockMemoryService([{ inGameDate: 'Day 1', content: 'A new diary entry.' }]);
            service = new ContextLoader(repo as never, repo as never, repo as never, repo as never, repo as never, promptRegistry as never, memoryService as never);
            const resultAfter = await service.loadWorldBlock(1);

            expect(resultBefore).not.toBe(resultAfter);
            expect(resultAfter).toContain('A new diary entry.');
        });

        it('orders diary entries oldest-first for narrative continuity', async () => {
            memoryService = makeMockMemoryService([
                { inGameDate: 'Day 3', content: 'Third day content.' }, // newest first from DB
                { inGameDate: 'Day 2', content: 'Second day content.' },
                { inGameDate: 'Day 1', content: 'First day content.' }, // oldest
            ]);
            const repo = makeMockRepo(em);
            service = new ContextLoader(repo as never, repo as never, repo as never, repo as never, repo as never, promptRegistry as never, memoryService as never);

            const result = await service.loadWorldBlock(1);

            const day1Pos = result.indexOf('First day content.');
            const day3Pos = result.indexOf('Third day content.');
            expect(day1Pos).toBeLessThan(day3Pos);
        });
    });

    describe('loadWorldBlock — merchant inventory at current location', () => {
        it('includes inventory block when an NPC with items is at currentLocationId', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 });
            em.find.mockResolvedValueOnce([{ id: 10, name: 'Aldric', profession: 'merchant', currentLocationId: 42 }]);
            em.find.mockResolvedValueOnce([{ npcId: 10, name: 'Iron Dagger', quantity: 2, merchantPrice: 5 }]);

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('## Merchant Inventory');
            expect(result).toContain('Aldric (merchant)');
            expect(result).toContain('Iron Dagger x2 — 5 gp');
        });

        it('omits inventory block for an NPC at currentLocationId with zero items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 });
            em.find.mockResolvedValueOnce([{ id: 10, name: 'Guard Bob', profession: null, currentLocationId: 42 }]);
            em.find.mockResolvedValueOnce([]); // no NpcItems

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Merchant Inventory');
        });

        it('produces no merchant inventory section when no NPCs at currentLocationId have items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 });
            em.find.mockResolvedValueOnce([]); // no NPCs at location

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Merchant Inventory');
        });

        it('includes a separate inventory block for each merchant when multiple NPCs have items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 });
            em.find.mockResolvedValueOnce([
                { id: 10, name: 'Aldric', profession: 'merchant', currentLocationId: 42 },
                { id: 11, name: 'Mira', profession: 'alchemist', currentLocationId: 42 },
            ]);
            em.find.mockResolvedValueOnce([
                { npcId: 10, name: 'Iron Dagger', quantity: 2, merchantPrice: 5 },
                { npcId: 11, name: 'Healing Potion', quantity: 3, merchantPrice: 50 },
            ]);

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('Aldric (merchant)');
            expect(result).toContain('Iron Dagger x2 — 5 gp');
            expect(result).toContain('Mira (alchemist)');
            expect(result).toContain('Healing Potion x3 — 50 gp');
        });
    });
});
