import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

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
    OnModuleInit: () => () => {},
    Optional: () => () => {},
    Inject: () => () => {},
    Logger: class { error = vi.fn(); },
}));

import { type ToolHandler } from '../llm/tool-registry.js';
import { GameEngineToolRegistrar } from './game-engine-tool-registrar.service.js';
import { SubjectType } from '../memory/entities/memory.entity.js';

function makeMemoryService() {
    return {
        createMemory: vi.fn().mockResolvedValue({ id: 1 }),
        searchMemories: vi.fn().mockResolvedValue([
            { type: 'fact', content: 'Goblin chief has a scar.', score: 0.1, subjectType: 'npc' },
        ]),
        writeDiaryEntry: vi.fn().mockResolvedValue(undefined),
    };
}

function makeEm(campaignDate = 'Day 3') {
    const mockSession = { id: 1, campaign: { id: 10 } };
    const mockCharacter = { id: 5 };
    const mockCampaign = { id: 10, inGameDate: campaignDate };
    return {
        findOne: vi.fn().mockImplementation((Entity: { name?: string }) => {
            const name = Entity?.name ?? '';
            if (name === 'GameSession') return Promise.resolve(mockSession);
            if (name === 'Campaign') return Promise.resolve(mockCampaign);
            return Promise.resolve(mockCharacter); // Character or anything else
        }),
        find: vi.fn().mockResolvedValue([
            { eventType: 'DM_NARRATIVE', content: { narrative: 'The quest begins.' } },
        ]),
    };
}

function makeRegistrar(
    memoryService: ReturnType<typeof makeMemoryService>,
    restService: ReturnType<typeof makeRestService> = makeRestService(),
) {
    const handlers = new Map<string, ToolHandler>();
    const toolRegistry = {
        register: (h: ToolHandler) => handlers.set(h.toolName, h),
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
    let restService: ReturnType<typeof makeRestService>;

    beforeEach(() => {
        vi.clearAllMocks();
        memoryService = makeMemoryService();
        restService = makeRestService();
        ({ handlers } = makeRegistrar(memoryService, restService));
    });

    describe('record_memory', () => {
        it('returns structured success when createMemory succeeds', async () => {
            const handler = handlers.get('record_memory');
            expect(handler).toBeDefined();

            const result = await handler!.execute(1, {
                subject_type: 'npc',
                content: 'The goblin chief has a distinctive scar.',
            });

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

            await handler!.execute(1, {
                subject_type: 'npc',
                subject_id: 'uuid-123',
                content: 'The goblin chief has a scar.',
            });

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

            const result = await handler!.execute(1, {
                subject_type: 'badtype',
                content: 'Some content.',
            });

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

            await handler!.execute(1, {
                query: 'goblin',
                subject_type: 'npc',
                subject_id: 'uuid-123',
                limit: 3,
            });

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
