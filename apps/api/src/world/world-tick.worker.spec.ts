// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    describe, expect, it, vi,
} from 'vitest';

import { Campaign } from '../campaign/entities/campaign.entity';
import { Npc } from './entities/npc.entity';
import { WorldTickWorker } from './world-tick.worker';
import { WorldEventSource, WorldEventStatus } from './world.enums';

function makeRedis(
    overrides: Record<string, unknown> = {},
): { set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> } {
    return {
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        ...overrides,
    };
}

function makeEm(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
    return {
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockReturnValue({}),
        flush: vi.fn().mockResolvedValue(undefined),
        persist: vi.fn(),
        ...overrides,
    };
}

function makeWorldService(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
    return {
        getDueNpcs: vi.fn().mockResolvedValue([]),
        getConversationPairs: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function makeMemoryService(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
    return {
        writeDiaryEntry: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function makeAnthropicClient(): { messages: { create: ReturnType<typeof vi.fn> } } {
    return {
        messages: {
            create: vi.fn().mockResolvedValue({ content: [] }),
        },
    };
}

function makeConfig(overrides: Record<string, unknown> = {}): { get: ReturnType<typeof vi.fn> } {
    return {
        get: vi.fn().mockReturnValue(10),
        ...overrides,
    };
}

function makeWorker(overrides: Partial<{
    em: Record<string, ReturnType<typeof vi.fn>>
    worldService: Record<string, ReturnType<typeof vi.fn>>
    memoryService: Record<string, ReturnType<typeof vi.fn>>
    redis: { set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> }
    anthropic: { messages: { create: ReturnType<typeof vi.fn> } }
    config: { get: ReturnType<typeof vi.fn> }
}> = {}): {
    worker: WorldTickWorker
    em: Record<string, ReturnType<typeof vi.fn>>
    redis: { set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> }
    worldService: Record<string, ReturnType<typeof vi.fn>>
    memoryService: Record<string, ReturnType<typeof vi.fn>>
    anthropic: { messages: { create: ReturnType<typeof vi.fn> } }
} {
    const em = overrides.em ?? makeEm();
    const worldService = overrides.worldService ?? makeWorldService();
    const memoryService = overrides.memoryService ?? makeMemoryService();
    const redis = overrides.redis ?? makeRedis();
    const anthropic = overrides.anthropic ?? makeAnthropicClient();
    const config = overrides.config ?? makeConfig();

    const campaign = Object.assign(new Campaign(), { id: 1, inGameDate: 'Day 5', inGameDay: 5 });
    em.findOne = vi.fn().mockImplementation((entity: unknown) => {
        if (entity === Campaign) {
            return Promise.resolve(campaign);
        }

        return Promise.resolve(null);
    });

    const worker = new WorldTickWorker(
        em as never,
        worldService as never,
        memoryService as never,
        redis as never,
        anthropic as never,
        'claude-haiku-test',
        config as never,
    );

    return {
        worker, em, redis, worldService, memoryService, anthropic,
    };
}

describe('WorldTickWorker', () => {
    describe('Redis lock acquisition', () => {
        it('acquires the lock before processing', async () => {
            const { worker, redis } = makeWorker();
            redis.set.mockResolvedValue('OK');

            await worker.process({ data: { campaignId: 42 } } as never);

            expect(redis.set).toHaveBeenCalledWith(
                'campaignLocked:42',
                '1',
                'EX',
                600,
                'NX',
            );
        });

        it('exits with no-op result when lock is already held', async () => {
            const { worker, redis, worldService } = makeWorker();
            // null means lock already held
            redis.set.mockResolvedValue(null);

            const result = await worker.process({ data: { campaignId: 42 } } as never);

            expect(result).toEqual({ status: 'skipped' });
            expect(worldService.getDueNpcs).not.toHaveBeenCalled();
        });

        it('releases the lock in finally even when processing succeeds', async () => {
            const { worker, redis } = makeWorker();
            redis.set.mockResolvedValue('OK');

            await worker.process({ data: { campaignId: 7 } } as never);

            expect(redis.del).toHaveBeenCalledWith('campaignLocked:7');
        });

        it('releases the lock in finally even when processing throws', async () => {
            const em = makeEm();
            em.findOne = vi.fn().mockRejectedValue(new Error('DB down'));
            const redis = makeRedis();
            redis.set.mockResolvedValue('OK');

            const worker = new WorldTickWorker(
                em as never,
                makeWorldService() as never,
                makeMemoryService() as never,
                redis as never,
                makeAnthropicClient() as never,
                'claude-haiku-test',
                makeConfig() as never,
            );

            await expect(worker.process({ data: { campaignId: 3 } } as never)).rejects.toThrow('DB down');
            expect(redis.del).toHaveBeenCalledWith('campaignLocked:3');
        });
    });

    describe('evaluateAgendas grouping', () => {
        it('makes parallel calls for NPCs at different locations', async () => {
            const { worker, anthropic } = makeWorker();

            const npcA = Object.assign(new Npc(), {
                id: 1, campaignId: 1, currentLocationId: 10, personalityTraits: [], agenda: 'go north',
            });
            const npcB = Object.assign(new Npc(), {
                id: 2, campaignId: 1, currentLocationId: 20, personalityTraits: [], agenda: 'find herb',
            });

            anthropic.messages.create.mockResolvedValue({
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        agenda: 'updated',
                        nextTickInGameDay: 10,
                        newLocationId: null,
                        departureDescription: null,
                    }),
                }],
            });

            vi.spyOn(worker['em'], 'find').mockResolvedValue([]);
            await worker.evaluateAgendas([npcA, npcB], 5, 1);

            expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
        });

        it('makes sequential calls for co-located NPCs', async () => {
            const { worker, anthropic } = makeWorker();

            const npcA = Object.assign(new Npc(), {
                id: 1, campaignId: 1, currentLocationId: 10, personalityTraits: [], agenda: 'patrol',
            });
            const npcB = Object.assign(new Npc(), {
                id: 2, campaignId: 1, currentLocationId: 10, personalityTraits: [], agenda: 'trade',
            });

            const callOrder: number[] = [];
            anthropic.messages.create.mockImplementation(async () => {
                callOrder.push(Date.now());
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            agenda: 'updated',
                            nextTickInGameDay: 10,
                            newLocationId: null,
                            departureDescription: null,
                        }),
                    }],
                };
            });

            vi.spyOn(worker['em'], 'find').mockResolvedValue([]);
            await worker.evaluateAgendas([npcA, npcB], 5, 1);

            expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
            expect(callOrder).toHaveLength(2);
        });
    });
});

describe('WorldTickWorker departure events', () => {
    it('builds departure WorldEvent when newLocationId is present', async () => {
        const em = makeEm();
        const worldService = makeWorldService();
        const memoryService = makeMemoryService();
        const redis = makeRedis();
        const anthropic = makeAnthropicClient();
        const config = makeConfig();

        const campaign = Object.assign(new Campaign(), { id: 1, inGameDate: 'Day 5', inGameDay: 5 });
        const npc = Object.assign(new Npc(), {
            id: 10,
            campaignId: 1,
            currentLocationId: 100,
            personalityTraits: [],
            agenda: 'travel',
            nextTickInGameDay: 3,
        });

        const createdEvents: unknown[] = [];
        em.findOne = vi.fn().mockImplementation((entity: unknown) => {
            if (entity === Campaign) {
                return Promise.resolve(campaign);
            }

            return Promise.resolve(null);
        });
        em.find = vi.fn().mockResolvedValue([]);
        em.create = vi.fn().mockImplementation((_entity: unknown, data: unknown) => {
            createdEvents.push(data);
            return data;
        });

        worldService.getDueNpcs = vi.fn().mockResolvedValue([npc]);
        worldService.getConversationPairs = vi.fn().mockResolvedValue([]);

        anthropic.messages.create.mockResolvedValue({
            content: [{
                type: 'text',
                text: JSON.stringify({
                    agenda: 'arrived at new place',
                    nextTickInGameDay: 10,
                    newLocationId: 200,
                    departureDescription: 'Gareth headed south to the forest.',
                }),
            }],
        });

        const worker = new WorldTickWorker(
            em as never,
            worldService as never,
            memoryService as never,
            redis as never,
            anthropic as never,
            'claude-haiku-test',
            config as never,
        );

        await worker.process({ data: { campaignId: 1 } } as never);

        const departureEvent = createdEvents.find(
            (event: unknown) => event !== null
                && typeof event === 'object'
                && 'source' in (event as object)
                && (event as { source: string }).source === WorldEventSource.WORLD_TICK,
        );
        expect(departureEvent).toBeDefined();
        expect((departureEvent as { locationId: number }).locationId).toBe(100);
        expect((departureEvent as { description: string }).description).toBe('Gareth headed south to the forest.');
    });

    it('does not create departure event when no movement occurs', async () => {
        const em = makeEm();
        const worldService = makeWorldService();
        const memoryService = makeMemoryService();
        const redis = makeRedis();
        const anthropic = makeAnthropicClient();
        const config = makeConfig();

        const campaign = Object.assign(new Campaign(), { id: 1, inGameDate: 'Day 5', inGameDay: 5 });
        const npc = Object.assign(new Npc(), {
            id: 10,
            campaignId: 1,
            currentLocationId: 100,
            personalityTraits: [],
            agenda: 'guard post',
            nextTickInGameDay: 3,
        });

        const createdEvents: unknown[] = [];
        em.findOne = vi.fn().mockImplementation((entity: unknown) => {
            if (entity === Campaign) {
                return Promise.resolve(campaign);
            }

            return Promise.resolve(null);
        });
        em.find = vi.fn().mockResolvedValue([]);
        em.create = vi.fn().mockImplementation((_entity: unknown, data: unknown) => {
            createdEvents.push(data);
            return data;
        });

        worldService.getDueNpcs = vi.fn().mockResolvedValue([npc]);
        worldService.getConversationPairs = vi.fn().mockResolvedValue([]);

        anthropic.messages.create.mockResolvedValue({
            content: [{
                type: 'text',
                text: JSON.stringify({
                    agenda: 'continued guarding',
                    nextTickInGameDay: 8,
                    newLocationId: null,
                    departureDescription: null,
                }),
            }],
        });

        const worker = new WorldTickWorker(
            em as never,
            worldService as never,
            memoryService as never,
            redis as never,
            anthropic as never,
            'claude-haiku-test',
            config as never,
        );

        await worker.process({ data: { campaignId: 1 } } as never);

        const worldTickEvents = createdEvents.filter(
            (event: unknown) => event !== null
                && typeof event === 'object'
                && 'source' in (event as object)
                && (event as { source: string }).source === WorldEventSource.WORLD_TICK,
        );
        expect(worldTickEvents).toHaveLength(0);
    });
});

describe('WorldTickWorker diary write', () => {
    it('calls writeDiaryEntry as fire-and-forget after other steps', async () => {
        const { worker, memoryService } = makeWorker();
        memoryService.writeDiaryEntry.mockResolvedValue(undefined);

        await worker.process({ data: { campaignId: 1 } } as never);

        expect(memoryService.writeDiaryEntry).toHaveBeenCalledWith(1, 'Day 5', []);
    });

    it('does not propagate diary write failure', async () => {
        const { worker, memoryService } = makeWorker();
        memoryService.writeDiaryEntry.mockRejectedValue(new Error('Diary failed'));

        await expect(worker.process({ data: { campaignId: 1 } } as never)).resolves.not.toThrow();
    });
});

describe('WorldTickWorker catastrophe (trigger_catastrophe)', () => {
    it('creates CATASTROPHE WorldEvent with locationId when Haiku invokes tool', async () => {
        const em = makeEm();
        const worldService = makeWorldService();
        const memoryService = makeMemoryService();
        const redis = makeRedis();
        const anthropic = makeAnthropicClient();
        const config = makeConfig();

        const campaign = Object.assign(new Campaign(), { id: 1, inGameDate: 'Day 5', inGameDay: 5 });
        em.findOne = vi.fn().mockImplementation((entity: unknown) => {
            if (entity === Campaign) {
                return Promise.resolve(campaign);
            }

            return Promise.resolve(null);
        });
        em.find = vi.fn().mockResolvedValue([]);

        const createdEvents: unknown[] = [];
        em.create = vi.fn().mockImplementation((_entity: unknown, data: unknown) => {
            createdEvents.push(data);
            return data;
        });

        // First call (agenda/catastrophe): return tool use; second call for conversations
        anthropic.messages.create.mockResolvedValue({
            content: [
                {
                    type: 'tool_use',
                    name: 'trigger_catastrophe',
                    /* eslint-disable @typescript-eslint/naming-convention */
                    input: { description: 'A great flood engulfs the valley.', location_id: 42 },
                    /* eslint-enable @typescript-eslint/naming-convention */
                },
            ],
        });

        const worker = new WorldTickWorker(
            em as never,
            worldService as never,
            memoryService as never,
            redis as never,
            anthropic as never,
            'claude-haiku-test',
            config as never,
        );

        await worker.rollCatastrophe(1, 'Day 5');

        const catastropheEvent = createdEvents.find(
            (event: unknown) => event !== null
                && typeof event === 'object'
                && 'source' in (event as object)
                && (event as { source: string }).source === WorldEventSource.CATASTROPHE,
        );
        expect(catastropheEvent).toBeDefined();
        expect((catastropheEvent as { locationId: number }).locationId).toBe(42);
        expect((catastropheEvent as { status: string }).status).toBe(WorldEventStatus.ACTIVE);
    });

    it('creates CATASTROPHE WorldEvent without locationId when no location given', async () => {
        const em = makeEm();
        em.find = vi.fn().mockResolvedValue([]);

        const createdEvents: unknown[] = [];
        em.create = vi.fn().mockImplementation((_entity: unknown, data: unknown) => {
            createdEvents.push(data);
            return data;
        });

        const anthropic = makeAnthropicClient();
        anthropic.messages.create.mockResolvedValue({
            content: [
                {
                    type: 'tool_use',
                    name: 'trigger_catastrophe',
                    input: { description: 'A plague spreads across the land.' },
                },
            ],
        });

        const worker = new WorldTickWorker(
            em as never,
            makeWorldService() as never,
            makeMemoryService() as never,
            makeRedis() as never,
            anthropic as never,
            'claude-haiku-test',
            makeConfig() as never,
        );

        await worker.rollCatastrophe(1, 'Day 5');

        const catastropheEvent = createdEvents.find(
            (event: unknown) => event !== null
                && typeof event === 'object'
                && 'source' in (event as object)
                && (event as { source: string }).source === WorldEventSource.CATASTROPHE,
        );
        expect(catastropheEvent).toBeDefined();
        expect((catastropheEvent as { locationId: unknown }).locationId).toBeNull();
    });
});

describe('WorldTickWorker applyOutcomes — conversation outcome merging', () => {
    it('updates agenda and lastConversedAt for both conversation participants', async () => {
        const em = makeEm();
        const sourceNpc = Object.assign(new Npc(), { id: 1, agenda: 'old agenda', lastConversedAt: null });
        const targetNpc = Object.assign(new Npc(), { id: 2, agenda: 'old agenda', lastConversedAt: null });

        em.findOne = vi.fn().mockImplementation((_entity: unknown, where: unknown) => {
            const whereClause = where as { id?: number; sourceNpcId?: number; targetNpcId?: number };
            if (whereClause.id === 1) {
                return Promise.resolve(sourceNpc);
            }

            if (whereClause.id === 2) {
                return Promise.resolve(targetNpc);
            }

            return Promise.resolve(null);
        });
        em.find = vi.fn().mockResolvedValue([]);
        em.create = vi.fn().mockReturnValue({});

        const worker = new WorldTickWorker(
            em as never,
            makeWorldService() as never,
            makeMemoryService() as never,
            makeRedis() as never,
            makeAnthropicClient() as never,
            'claude-haiku-test',
            makeConfig() as never,
        );

        await worker.applyOutcomes(
            {
                agendaOutcomes: [],
                conversationOutcomes: [
                    {
                        sourceNpcId: 1,
                        targetNpcId: 2,
                        newAgendaSource: 'pursue the artifact',
                        newAgendaTarget: 'warn the guild',
                        relationshipChange: null,
                        itemExchanged: null,
                    },
                ],
                departureEvents: [],
            },
            [],
        );

        expect(sourceNpc.agenda).toBe('pursue the artifact');
        expect(targetNpc.agenda).toBe('warn the guild');
        expect(sourceNpc.lastConversedAt).toBeInstanceOf(Date);
        expect(targetNpc.lastConversedAt).toBeInstanceOf(Date);
        expect(em.flush).toHaveBeenCalledTimes(1);
    });

    it('does not modify NPC state when conversation outcome is empty', async () => {
        const em = makeEm();
        const sourceNpc = Object.assign(new Npc(), { id: 1, agenda: 'original', lastConversedAt: null });
        const targetNpc = Object.assign(new Npc(), { id: 2, agenda: 'original', lastConversedAt: null });

        em.findOne = vi.fn().mockImplementation((_entity: unknown, where: unknown) => {
            const whereClause = where as { id?: number };
            if (whereClause.id === 1) {
                return Promise.resolve(sourceNpc);
            }

            if (whereClause.id === 2) {
                return Promise.resolve(targetNpc);
            }

            return Promise.resolve(null);
        });

        const worker = new WorldTickWorker(
            em as never,
            makeWorldService() as never,
            makeMemoryService() as never,
            makeRedis() as never,
            makeAnthropicClient() as never,
            'claude-haiku-test',
            makeConfig() as never,
        );

        await worker.applyOutcomes(
            {
                agendaOutcomes: [],
                conversationOutcomes: [
                    {
                        sourceNpcId: 1,
                        targetNpcId: 2,
                        newAgendaSource: null,
                        newAgendaTarget: null,
                        relationshipChange: null,
                        itemExchanged: null,
                    },
                ],
                departureEvents: [],
            },
            [],
        );

        expect(sourceNpc.agenda).toBe('original');
        expect(targetNpc.agenda).toBe('original');
        expect(em.flush).toHaveBeenCalledTimes(1);
    });

    it('flushes exactly once even with multiple agenda and conversation outcomes', async () => {
        const em = makeEm();
        const npc1 = Object.assign(new Npc(), { id: 1, agenda: null, lastConversedAt: null });
        const npc2 = Object.assign(new Npc(), { id: 2, agenda: null, lastConversedAt: null });
        const agendaNpc = Object.assign(new Npc(), { id: 3, agenda: 'patrol', nextTickInGameDay: 8 });

        em.findOne = vi.fn().mockImplementation((_entity: unknown, where: unknown) => {
            const whereClause = where as { id?: number };
            if (whereClause.id === 1) {
                return Promise.resolve(npc1);
            }

            if (whereClause.id === 2) {
                return Promise.resolve(npc2);
            }

            return Promise.resolve(null);
        });
        em.create = vi.fn().mockReturnValue({});

        const worker = new WorldTickWorker(
            em as never,
            makeWorldService() as never,
            makeMemoryService() as never,
            makeRedis() as never,
            makeAnthropicClient() as never,
            'claude-haiku-test',
            makeConfig() as never,
        );

        await worker.applyOutcomes(
            {
                agendaOutcomes: [
                    {
                        npcId: 3, agenda: 'updated patrol', nextTickInGameDay: 12, newLocationId: null, departureDescription: null,
                    },
                ],
                conversationOutcomes: [
                    {
                        sourceNpcId: 1,
                        targetNpcId: 2,
                        newAgendaSource: 'new agenda 1',
                        newAgendaTarget: 'new agenda 2',
                        relationshipChange: null,
                        itemExchanged: null,
                    },
                ],
                departureEvents: [],
            },
            [agendaNpc],
        );

        expect(em.flush).toHaveBeenCalledTimes(1);
    });
});
