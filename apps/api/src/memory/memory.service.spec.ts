import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { DiaryEntryType } from './entities/diary-entry.entity.js';
import { SubjectType } from './entities/memory.entity.js';
import { type MemorySearchResult, MemoryService } from './memory.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({
    type: {},
    OptionalProps: Symbol('OptionalProps'),
    Collection: class {}, // eslint-disable-line @typescript-eslint/no-extraneous-class
    Type: class {}, // eslint-disable-line @typescript-eslint/no-extraneous-class
}));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} })); // eslint-disable-line @typescript-eslint/no-extraneous-class
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Inject: () => () => {},
    Logger: class {
        error = vi.fn();
    },
}));
/* eslint-enable @typescript-eslint/naming-convention */

function makeEmbeddingService(embedding: number[] | null = [0.1, 0.2]) {
    return { generateEmbedding: vi.fn().mockResolvedValue(embedding) };
}

function makeAnthropicClient(content = 'A brave day in the dungeon.') {
    return {
        messages: {
            create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: content }],
            }),
        },
    };
}

function makeEm() {
    const entities: unknown[] = [];
    return {
        create: vi.fn().mockImplementation((_entityClass: unknown, data: unknown) => {
            const entity = { ...data as object, id: entities.length + 1 };
            entities.push(entity);
            return entity;
        }),
        persist: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        find: vi.fn().mockResolvedValue([]),
        getConnection: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
        }),
    };
}

describe('MemoryService', () => {
    let em: ReturnType<typeof makeEm>;
    let embeddingService: ReturnType<typeof makeEmbeddingService>;
    let anthropicClient: ReturnType<typeof makeAnthropicClient>;
    let service: MemoryService;
    const model = 'claude-haiku-test';

    beforeEach(() => {
        vi.clearAllMocks();
        em = makeEm();
        embeddingService = makeEmbeddingService();
        anthropicClient = makeAnthropicClient();
        service = new MemoryService(
            em as never,
            embeddingService as never,
            anthropicClient as never,
            model,
        );
    });

    // ── writeDiaryEntry ──────────────────────────────────────────────────────────

    describe('writeDiaryEntry', () => {
        it('creates and persists a DiaryEntry with content and embedding', async () => {
            const gameEvents = [{ eventType: 'DM_NARRATIVE', content: { narrative: 'The goblin attacks.' } }];
            await service.writeDiaryEntry(1, 'Day 3', gameEvents as never);

            expect(anthropicClient.messages.create).toHaveBeenCalledOnce();
            expect(em.create).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    inGameDate: 'Day 3',
                    content: expect.any(String) as string,
                }),
            );
            expect(em.flush).toHaveBeenCalledOnce();
        });

        it('truncates Haiku content to 1000 characters', async () => {
            const longContent = 'x'.repeat(2000);
            anthropicClient.messages.create.mockResolvedValue({
                content: [{ type: 'text', text: longContent }],
            });

            await service.writeDiaryEntry(1, 'Day 3', []);

            const [, entityData] = em.create.mock.calls[0] as [unknown, { content: string }];
            expect(entityData.content.length).toBeLessThanOrEqual(1000);
        });

        it('persists entry with null embedding when embedding service fails', async () => {
            embeddingService.generateEmbedding.mockResolvedValue(null);

            await service.writeDiaryEntry(1, 'Day 3', []);

            const [, entityData] = em.create.mock.calls[0] as [unknown, { embedding: number[] | null }];
            expect(entityData.embedding).toBeNull();
            expect(em.flush).toHaveBeenCalledOnce();
        });

        it('persists a MEMORIAL entry with entryType set to MEMORIAL', async () => {
            await service.writeDiaryEntry(1, 'Day 5', [], DiaryEntryType.MEMORIAL);

            const [, entityData] = em.create.mock.calls[0] as [unknown, { entryType: string }];
            expect(entityData.entryType).toBe(DiaryEntryType.MEMORIAL);
            expect(em.flush).toHaveBeenCalledOnce();
        });

        it('does not rethrow when Haiku fails for a MEMORIAL entry', async () => {
            anthropicClient.messages.create.mockRejectedValueOnce(new Error('Haiku down'));

            await expect(
                service.writeDiaryEntry(1, 'Day 5', [], DiaryEntryType.MEMORIAL),
            ).resolves.toBeUndefined();
            expect(em.flush).not.toHaveBeenCalled();
        });
    });

    // ── getRecentDiaryEntries ────────────────────────────────────────────────────

    describe('getRecentDiaryEntries', () => {
        it('returns up to 7 entries when more exist', async () => {
            const entries = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, inGameDate: `Day ${index + 1}` }));
            em.find.mockResolvedValue(entries.slice(0, 7));

            const result = await service.getRecentDiaryEntries(1);

            expect(result).toHaveLength(7);
            expect(em.find).toHaveBeenCalledWith(
                expect.anything(),
                { campaign: { id: 1 } },
                expect.objectContaining({ limit: 7, orderBy: { createdAt: 'DESC' } }),
            );
        });

        it('returns all entries when fewer than 7 exist', async () => {
            const entries = [{ id: 1 }, { id: 2 }];
            em.find.mockResolvedValue(entries);

            const result = await service.getRecentDiaryEntries(1);

            expect(result).toHaveLength(2);
        });

        it('accepts a custom limit', async () => {
            em.find.mockResolvedValue([]);

            await service.getRecentDiaryEntries(1, 3);

            expect(em.find).toHaveBeenCalledWith(
                expect.anything(),
                { campaign: { id: 1 } },
                expect.objectContaining({ limit: 3 }),
            );
        });
    });

    // ── createMemory ─────────────────────────────────────────────────────────────

    describe('createMemory', () => {
        it('creates and persists a Memory with embedding', async () => {
            await service.createMemory(1, SubjectType.NPC, 'Goblin chief has a scar.', 'npc-uuid');

            expect(em.create).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    subjectType: SubjectType.NPC,
                    subjectId: 'npc-uuid',
                    content: 'Goblin chief has a scar.',
                    embedding: [0.1, 0.2],
                }),
            );
            expect(em.flush).toHaveBeenCalledOnce();
        });

        it('persists with null embedding when embedding service fails', async () => {
            embeddingService.generateEmbedding.mockResolvedValue(null);

            await service.createMemory(1, SubjectType.GENERAL, 'Something happened.');

            const [, entityData] = em.create.mock.calls[0] as [unknown, { embedding: number[] | null }];
            expect(entityData.embedding).toBeNull();
            expect(em.flush).toHaveBeenCalledOnce();
        });

        it('creates without subjectId when not provided', async () => {
            await service.createMemory(1, SubjectType.GENERAL, 'A general fact.');

            const [, entityData] = em.create.mock.calls[0] as [unknown, { subjectId: string | null }];
            expect(entityData.subjectId).toBeNull();
        });

        it('throws when subject type is invalid', async () => {
            await expect(
                service.createMemory(1, 'invalid-type' as SubjectType, 'Content.'),
            ).rejects.toThrow();
            expect(em.flush).not.toHaveBeenCalled();
        });
    });

    // ── searchMemories ───────────────────────────────────────────────────────────

    describe('searchMemories', () => {
        const diaryRow = {
            type: 'diary',
            id: 1,
            content: 'A day in the dungeon',
            inGameDate: 'Day 3',
            subjectType: null,
            subjectId: null,
            score: 0.1,
        };
        const factRow = {
            type: 'fact',
            id: 2,
            content: 'Goblin chief has a scar',
            inGameDate: null,
            subjectType: 'npc',
            subjectId: 'uuid-1',
            score: 0.2,
        };

        it('merges and sorts results from both tables by score', async () => {
            const conn = em.getConnection();
            conn.execute
                .mockResolvedValueOnce([diaryRow])
                .mockResolvedValueOnce([factRow]);

            const results = await service.searchMemories(1, 'goblin');

            expect(results).toHaveLength(2);
            // lower score = more similar
            expect(results[0]!.type).toBe('diary');
            expect(results[1]!.type).toBe('fact');
        });

        it('skips diary query and filters memory by subject type when subjectType is given', async () => {
            const conn = em.getConnection();
            // Return a result so FTS fallback is not triggered
            conn.execute.mockResolvedValueOnce([factRow]);

            await service.searchMemories(1, 'goblin', { subjectType: SubjectType.NPC });

            // Only one SQL call — diary is skipped entirely; memory query uses subjectType
            expect(conn.execute).toHaveBeenCalledTimes(1);
            const [, memoryParameters] = conn.execute.mock.calls[0] as [string, unknown[]];
            expect(memoryParameters).toContain('npc');
        });

        it('respects the limit option', async () => {
            const conn = em.getConnection();
            const rows = Array.from({ length: 10 }, (_, index) => ({ ...diaryRow, id: index, score: index * 0.1 }));
            conn.execute
                .mockResolvedValueOnce(rows)
                .mockResolvedValueOnce([]);

            const results = await service.searchMemories(1, 'test', { limit: 3 });

            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('falls back to full-text search when vector search returns no results', async () => {
            const conn = em.getConnection();
            // First two calls: vector search returns nothing
            conn.execute
                // diary vector
                .mockResolvedValueOnce([])
                // memory vector
                .mockResolvedValueOnce([])
                // Second two calls: full-text returns results
                // diary FTS
                .mockResolvedValueOnce([diaryRow])
                // memory FTS
                .mockResolvedValueOnce([]);

            const results = await service.searchMemories(1, 'goblin');

            expect(results).toHaveLength(1);
            expect(results[0]!.type).toBe('diary');
        });

        it('falls back to full-text search when embedding generation fails', async () => {
            embeddingService.generateEmbedding.mockResolvedValue(null);
            const conn = em.getConnection();
            conn.execute
                // diary FTS
                .mockResolvedValueOnce([factRow])
                // memory FTS
                .mockResolvedValueOnce([]);

            const results = await service.searchMemories(1, 'goblin');

            expect(results).toHaveLength(1);
            expect(results[0]!.type).toBe('fact');
        });

        it('returns empty array when both vector and full-text search find nothing', async () => {
            const conn = em.getConnection();
            conn.execute.mockResolvedValue([]);

            const results = await service.searchMemories(1, 'nothing matches');

            expect(results).toHaveLength(0);
        });

        it('returns typed MemorySearchResult objects', async () => {
            const conn = em.getConnection();
            conn.execute
                .mockResolvedValueOnce([diaryRow])
                .mockResolvedValueOnce([]);

            const results = await service.searchMemories(1, 'test');

            const first = results[0] as MemorySearchResult;
            expect(first).toMatchObject({
                type: 'diary',
                content: expect.any(String) as string,
                score: expect.any(Number) as number,
                inGameDate: expect.any(String) as string,
            });
        });
    });
});
