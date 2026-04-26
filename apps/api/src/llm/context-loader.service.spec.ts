/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { GameEvent } from '../session/entities/game-event.entity';
import { GameSession } from '../session/entities/game-session.entity';
import { EventType, SceneType } from '../session/session.enums';
import { ContextLoader } from './context-loader.service';

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
    const event = new GameEvent();
    const session = Object.assign(new GameSession(), { id: 1 });
    Object.assign(event, {
        id: 1, session, eventType: EventType.PLAYER_INPUT, content: {}, createdAt: new Date(), ...overrides,
    });
    return event;
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
            em.findOneOrFail.mockResolvedValue({
                id: 1, loreDocument: null, antagonistPlanState: null, inGameDate: null,
            });

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
        it('includes expanded character sheet details and personality when present', async () => {
            em.findOne.mockResolvedValueOnce({
                id: 7,
                name: 'Seraphina',
                level: 4,
                hp: 22,
                maxHp: 27,
                ac: 15,
                abilityScores: {
                    STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10,
                },
                conditions: ['poisoned'],
                spellSlots: [{ level: 1, total: 4, used: 1 }],
                skillProficiencies: {
                    Acrobatics: 'none',
                    'Animal Handling': 'none',
                    Arcana: 'expert',
                    Athletics: 'none',
                    Deception: 'none',
                    History: 'proficient',
                    Insight: 'none',
                    Intimidation: 'none',
                    Investigation: 'proficient',
                    Medicine: 'none',
                    Nature: 'none',
                    Perception: 'none',
                    Performance: 'none',
                    Persuasion: 'none',
                    Religion: 'none',
                    'Sleight of Hand': 'none',
                    Stealth: 'none',
                    Survival: 'none',
                },
                personalityTraits: ['I notice the details others miss.'],
                ideals: ['Truth matters more than comfort.'],
                bonds: ['My mentor deserves answers.'],
                flaws: ['I overthink every danger.'],
                race: { name: 'Elf' },
                srdClass: { name: 'Wizard' },
            });
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: null });

            const result = await service.loadWorldBlock(1, 7);

            expect(result).toContain('Race: Elf');
            expect(result).toContain('Class: Wizard');
            expect(result).toContain('STR: 8 (-1)');
            expect(result).toContain('INT: 16 (+3)');
            expect(result).toContain('Skill Proficiencies: Arcana (expert), History (proficient), Investigation (proficient)');
            expect(result).toContain('## Personality');
            expect(result).toContain('Traits: I notice the details others miss.');
            expect(result).toContain('Ideals: Truth matters more than comfort.');
            expect(result).toContain('Bonds: My mentor deserves answers.');
            expect(result).toContain('Flaws: I overthink every danger.');
        });

        it('omits the personality section when all personality arrays are empty', async () => {
            em.findOne.mockResolvedValueOnce({
                id: 7,
                name: 'Tarin',
                level: 2,
                hp: 14,
                maxHp: 14,
                ac: 13,
                abilityScores: {
                    STR: 15, DEX: 12, CON: 14, INT: 10, WIS: 8, CHA: 13,
                },
                conditions: [],
                spellSlots: [],
                skillProficiencies: {
                    Acrobatics: 'none',
                    'Animal Handling': 'none',
                    Arcana: 'none',
                    Athletics: 'proficient',
                    Deception: 'none',
                    History: 'none',
                    Insight: 'none',
                    Intimidation: 'proficient',
                    Investigation: 'none',
                    Medicine: 'none',
                    Nature: 'none',
                    Perception: 'none',
                    Performance: 'none',
                    Persuasion: 'none',
                    Religion: 'none',
                    'Sleight of Hand': 'none',
                    Stealth: 'none',
                    Survival: 'proficient',
                },
                personalityTraits: [],
                ideals: [],
                bonds: [],
                flaws: [],
                race: { name: 'Human' },
                srdClass: { name: 'Fighter' },
            });
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: null });

            const result = await service.loadWorldBlock(1, 7);

            expect(result).not.toContain('## Personality');
            expect(result).toContain('Skill Proficiencies: Athletics (proficient), Intimidation (proficient), Survival (proficient)');
        });

        it('includes diary entries in the world block when present', async () => {
            memoryService = makeMockMemoryService([
                { inGameDate: 'Day 2', content: 'The second day was eventful.' },
                { inGameDate: 'Day 1', content: 'The adventure began.' },
            ]);
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

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('## Recent Diary');
            expect(result).toContain('Day 1');
            expect(result).toContain('The adventure began.');
        });

        it('omits diary section without error when no entries exist', async () => {
            memoryService = makeMockMemoryService([]);
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

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Recent Diary');
        });

        it('produces different output when a new diary entry is added (breakpoint 3 rebuilds)', async () => {
            const repo = makeMockRepo(em);

            // First call: no entries
            const firstMemoryService = makeMockMemoryService([]);
            const firstService = new ContextLoader(
                repo as never,
                repo as never,
                repo as never,
                repo as never,
                repo as never,
                promptRegistry as never,
                firstMemoryService as never,
            );
            const resultBefore = await firstService.loadWorldBlock(1);

            // Second call: new entry added
            const secondMemoryService = makeMockMemoryService([{ inGameDate: 'Day 1', content: 'A new diary entry.' }]);
            const secondService = new ContextLoader(
                repo as never,
                repo as never,
                repo as never,
                repo as never,
                repo as never,
                promptRegistry as never,
                secondMemoryService as never,
            );
            const resultAfter = await secondService.loadWorldBlock(1);

            expect(resultBefore).not.toBe(resultAfter);
            expect(resultAfter).toContain('A new diary entry.');
        });

        it('orders diary entries oldest-first for narrative continuity', async () => {
            memoryService = makeMockMemoryService([
                // newest first from DB
                { inGameDate: 'Day 3', content: 'Third day content.' },
                { inGameDate: 'Day 2', content: 'Second day content.' },
                // oldest
                { inGameDate: 'Day 1', content: 'First day content.' },
            ]);
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

            const result = await service.loadWorldBlock(1);

            const day1Pos = result.indexOf('First day content.');
            const day3Pos = result.indexOf('Third day content.');
            expect(day1Pos).toBeLessThan(day3Pos);
        });
    });

    describe('loadWorldBlock — merchant inventory at current location', () => {
        it('includes inventory block when an NPC with items is at currentLocationId', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 }); // campaign
            em.findOne.mockResolvedValueOnce({ id: 42, name: 'Market District', description: 'A bustling market.', parentLocationId: null }); // currentLocation
            em.find.mockResolvedValueOnce([]); // subLocations
            em.find.mockResolvedValueOnce([{ id: 10, name: 'Aldric', profession: 'merchant', currentLocationId: 42, alive: true, disposition: null }]);
            em.find.mockResolvedValueOnce([{ npcId: 10, name: 'Iron Dagger', quantity: 2, merchantPrice: 5 }]);
            em.find.mockResolvedValueOnce([]); // locationItems

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('ID: 42');
            expect(result).toContain('## Merchant Inventory');
            expect(result).toContain('Aldric (merchant)');
            expect(result).toContain('Iron Dagger x2 — 5 gp');
        });

        it('omits inventory block for an NPC at currentLocationId with zero items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 }); // campaign
            em.findOne.mockResolvedValueOnce({ id: 42, name: 'Market District', description: 'A bustling market.', parentLocationId: null }); // currentLocation
            em.find.mockResolvedValueOnce([]); // subLocations
            em.find.mockResolvedValueOnce([{ id: 10, name: 'Guard Bob', profession: null, currentLocationId: 42, alive: true, disposition: null }]);
            // no NpcItems
            em.find.mockResolvedValueOnce([]);
            em.find.mockResolvedValueOnce([]); // locationItems

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Merchant Inventory');
        });

        it('produces no merchant inventory section when no NPCs at currentLocationId have items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 }); // campaign
            em.findOne.mockResolvedValueOnce({ id: 42, name: 'Market District', description: 'A bustling market.', parentLocationId: null }); // currentLocation
            em.find.mockResolvedValueOnce([]); // subLocations
            // no NPCs at location
            em.find.mockResolvedValueOnce([]);
            em.find.mockResolvedValueOnce([]); // locationItems

            const result = await service.loadWorldBlock(1);

            expect(result).not.toContain('## Merchant Inventory');
        });

        it('includes a separate inventory block for each merchant when multiple NPCs have items', async () => {
            em.findOne.mockResolvedValueOnce({ id: 1, currentLocationId: 42 }); // campaign
            em.findOne.mockResolvedValueOnce({ id: 42, name: 'Market District', description: 'A bustling market.', parentLocationId: null }); // currentLocation
            em.find.mockResolvedValueOnce([]); // subLocations
            em.find.mockResolvedValueOnce([
                { id: 10, name: 'Aldric', profession: 'merchant', currentLocationId: 42, alive: true, disposition: null },
                { id: 11, name: 'Mira', profession: 'alchemist', currentLocationId: 42, alive: true, disposition: null },
            ]);
            em.find.mockResolvedValueOnce([
                { npcId: 10, name: 'Iron Dagger', quantity: 2, merchantPrice: 5 },
                { npcId: 11, name: 'Healing Potion', quantity: 3, merchantPrice: 50 },
            ]);
            em.find.mockResolvedValueOnce([]); // locationItems

            const result = await service.loadWorldBlock(1);

            expect(result).toContain('Aldric (merchant)');
            expect(result).toContain('Iron Dagger x2 — 5 gp');
            expect(result).toContain('Mira (alchemist)');
            expect(result).toContain('Healing Potion x3 — 50 gp');
        });
    });

    describe('loadWorldBlock — npc memories at current location', () => {
        it('includes an NPC knowledge section when memories are provided', async () => {
            const result = await service.loadWorldBlock(1, undefined, 'Aldric remembers: The bridge is trapped.');

            expect(result).toContain('## NPC Knowledge');
            expect(result).toContain('Aldric remembers: The bridge is trapped.');
        });

        it('omits the NPC knowledge section when npcMemories is absent or empty', async () => {
            const withoutMemories = await service.loadWorldBlock(1);
            const withEmptyMemories = await service.loadWorldBlock(1, undefined, '   ');

            expect(withoutMemories).not.toContain('## NPC Knowledge');
            expect(withEmptyMemories).not.toContain('## NPC Knowledge');
        });
    });
});
