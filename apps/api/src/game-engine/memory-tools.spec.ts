import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { type ToolHandler } from '../llm/tool-registry.js';
import { SubjectType } from '../memory/entities/memory.entity.js';
import { GameEngineToolRegistrar } from './game-engine-tool-registrar.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToMany: () => () => {},
    OneToOne: () => () => {},
    Index: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {}, EntityRepository: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Module: () => () => {},
    OnModuleInit: () => () => {},
    Optional: () => () => {},
    Inject: () => () => {},
    forwardRef: (function_: () => unknown) => function_,
    Logger: class {
        error = vi.fn();
    },
}));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeMemoryService() {
    return {
        createMemory: vi.fn().mockResolvedValue({ id: 1 }),
        searchMemories: vi.fn().mockResolvedValue([
            { type: 'fact', content: 'Goblin chief has a scar.', score: 0.1, subjectType: 'npc' },
        ]),
        writeDiaryEntry: vi.fn().mockResolvedValue(undefined),
    };
}

function makeNpcMemoryService() {
    return {
        createNpcMemory: vi.fn().mockResolvedValue({ id: 77 }),
    };
}

function makeEm(campaignDate = 'Day 3') {
    const mockSession = { id: 1, campaign: { id: 10 } };
    const mockCharacter = { id: 5 };
    const mockCampaign = { id: 10, inGameDate: campaignDate };
    const mockNpc = { id: 42, campaignId: 10, name: 'Aldric' };
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        findOne: vi.fn().mockImplementation((EntityClass: { name?: string }, where?: { id?: number; campaignId?: number }) => {
            const name = EntityClass?.name ?? '';
            if (name === 'GameSession') {
                return Promise.resolve(mockSession);
            }

            if (name === 'Campaign') {
                return Promise.resolve(mockCampaign);
            }

            if (name === 'Npc') {
                if (where?.id === 42 && where.campaignId === 10) {
                    return Promise.resolve(mockNpc);
                }

                return Promise.resolve(null);
            }

            // Character or anything else
            return Promise.resolve(mockCharacter);
        }),
        find: vi.fn().mockResolvedValue([
            { eventType: 'DM_NARRATIVE', content: { narrative: 'The quest begins.' } },
        ]),
    };
}

function makeRegistrar(
    memoryService: ReturnType<typeof makeMemoryService>,
    npcMemoryService: ReturnType<typeof makeNpcMemoryService> = makeNpcMemoryService(),
    restService: ReturnType<typeof makeRestService> = makeRestService(),
) {
    const handlers = new Map<string, ToolHandler>();
    const toolRegistry = {
        register: (handler: ToolHandler) => handlers.set(handler.toolName, handler),
    };

    const em = makeEm();

    const registrar = new GameEngineToolRegistrar(
        toolRegistry as never,
        em as never,
        {} as never,
        {} as never,
        {} as never,
        restService as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        memoryService as never,
        npcMemoryService as never,
        {} as never,
        { endCampaign: vi.fn() } as never,
        { publish: vi.fn() } as never,
        { exists: vi.fn().mockResolvedValue(0) } as never,
    );
    registrar.onModuleInit();

    return { handlers, em };
}

function makeRestService() {
    return {
        takeLongRest: vi.fn().mockResolvedValue({ success: true, data: { hp: 40 } }),
        takeShortRest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };
}

describe('memory tool handlers', () => {
    let handlers: Map<string, ToolHandler>;
    let memoryService: ReturnType<typeof makeMemoryService>;
    let npcMemoryService: ReturnType<typeof makeNpcMemoryService>;
    let restService: ReturnType<typeof makeRestService>;

    beforeEach(() => {
        vi.clearAllMocks();
        memoryService = makeMemoryService();
        npcMemoryService = makeNpcMemoryService();
        restService = makeRestService();
        ({ handlers } = makeRegistrar(memoryService, npcMemoryService, restService));
    });

    describe('record_memory', () => {
        it('returns structured success when createMemory succeeds', async () => {
            const handler = handlers.get('record_memory');
            expect(handler).toBeDefined();

            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await handler!.execute(1, {
                subject_type: 'npc',
                content: 'The goblin chief has a distinctive scar.',
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(result.success).toBe(true);
            expect(memoryService.createMemory).toHaveBeenCalledWith(
                expect.any(Number),
                SubjectType.NPC,
                'The goblin chief has a distinctive scar.',
                undefined,
            );
        });

        it('passes subject_id when provided', async () => {
            const handler = handlers.get('record_memory');

            /* eslint-disable @typescript-eslint/naming-convention */
            await handler!.execute(1, {
                subject_type: 'npc',
                subject_id: 'uuid-123',
                content: 'The goblin chief has a scar.',
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(memoryService.createMemory).toHaveBeenCalledWith(
                expect.any(Number),
                SubjectType.NPC,
                'The goblin chief has a scar.',
                'uuid-123',
            );
        });

        it('returns structured failure when createMemory throws', async () => {
            memoryService.createMemory.mockRejectedValue(new Error('Invalid subjectType: badtype'));
            const handler = handlers.get('record_memory');

            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await handler!.execute(1, {
                subject_type: 'badtype',
                content: 'Some content.',
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(result.success).toBe(false);
            expect(result.errorCode).toBeDefined();
        });
    });

    describe('search_memories', () => {
        it('returns structured success with results when searchMemories succeeds', async () => {
            const handler = handlers.get('search_memories');
            expect(handler).toBeDefined();

            const result = await handler!.execute(1, { query: 'goblin' });

            expect(result.success).toBe(true);
            expect((result.data as { results: unknown[] }).results).toHaveLength(1);
            expect(memoryService.searchMemories).toHaveBeenCalled();
        });

        it('passes options when provided', async () => {
            const handler = handlers.get('search_memories');

            /* eslint-disable @typescript-eslint/naming-convention */
            await handler!.execute(1, {
                query: 'goblin',
                subject_type: 'npc',
                subject_id: 'uuid-123',
                limit: 3,
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(memoryService.searchMemories).toHaveBeenCalledWith(
                expect.any(Number),
                'goblin',
                expect.objectContaining({ subjectType: 'npc', subjectId: 'uuid-123', limit: 3 }),
            );
        });

        it('returns structured failure when searchMemories throws', async () => {
            memoryService.searchMemories.mockRejectedValue(new Error('DB error'));
            const handler = handlers.get('search_memories');

            const result = await handler!.execute(1, { query: 'goblin' });

            expect(result.success).toBe(false);
            expect(result.errorCode).toBeDefined();
        });
    });

    describe('record_npc_memory', () => {
        it('creates memory and returns id on success', async () => {
            const handler = handlers.get('record_npc_memory');
            expect(handler).toBeDefined();

            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await handler!.execute(1, {
                npc_id: 42,
                content: 'The adventurer paid for the broken cartwheel.',
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(result).toEqual({ success: true, data: { id: 77 } });
            expect(npcMemoryService.createNpcMemory).toHaveBeenCalledWith(
                42,
                'The adventurer paid for the broken cartwheel.',
                'Day 3',
            );
        });

        it('returns NPC_NOT_FOUND without throwing for an unknown npc_id', async () => {
            const handler = handlers.get('record_npc_memory');

            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await handler!.execute(1, {
                npc_id: 999,
                content: 'This should not be recorded.',
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('NPC_NOT_FOUND');
            expect(npcMemoryService.createNpcMemory).not.toHaveBeenCalled();
        });
    });

    // ── take_long_rest diary integration ─────────────────────────────────────────

    describe('take_long_rest', () => {
        it('writes diary entry before returning the rest result', async () => {
            const handler = handlers.get('take_long_rest');
            expect(handler).toBeDefined();

            const result = await handler!.execute(1, {});

            expect(result.success).toBe(true);
            expect(restService.takeLongRest).toHaveBeenCalledBefore(
                memoryService.writeDiaryEntry as ReturnType<typeof vi.fn>,
            );
            expect(memoryService.writeDiaryEntry).toHaveBeenCalledOnce();
        });

        it('passes campaignId, inGameDate, and events to writeDiaryEntry', async () => {
            const handler = handlers.get('take_long_rest');

            await handler!.execute(1, {});

            expect(memoryService.writeDiaryEntry).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(String),
                expect.any(Array),
            );
        });
    });
});
