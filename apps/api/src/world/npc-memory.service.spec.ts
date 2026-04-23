import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { NpcMemoryService } from './npc-memory.service.js';

function makeEmbeddingService(embedding: number[] | null = [0.1, 0.2]) {
    return {
        generateEmbedding: vi.fn().mockResolvedValue(embedding),
    };
}

function makeEntityManager(rows: unknown[] = []) {
    const created: Array<Record<string, unknown>> = [];
    const connection = {
        execute: vi.fn().mockResolvedValue(rows),
    };

    return {
        created,
        create: vi.fn().mockImplementation((_entity: unknown, data: Record<string, unknown>) => {
            const entity = { id: 123, ...data };
            created.push(entity);
            return entity;
        }),
        persist: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        getConnection: vi.fn().mockReturnValue(connection),
        connection,
    };
}

describe('NpcMemoryService', () => {
    let em: ReturnType<typeof makeEntityManager>;
    let embeddingService: ReturnType<typeof makeEmbeddingService>;
    let service: NpcMemoryService;

    beforeEach(() => {
        em = makeEntityManager();
        embeddingService = makeEmbeddingService();
        service = new NpcMemoryService(em as never, embeddingService as never);
    });

    describe('createNpcMemory', () => {
        it('creates a row with an embedding and null sourceNpcId when omitted', async () => {
            const memory = await service.createNpcMemory(7, 'Saw the adventurer spare a bandit.', 'Day 3');

            expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('Saw the adventurer spare a bandit.');
            expect(em.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                npcId: 7,
                content: 'Saw the adventurer spare a bandit.',
                embedding: [0.1, 0.2],
                inGameDate: 'Day 3',
                sourceNpcId: null,
            }));
            expect(em.flush).toHaveBeenCalledTimes(1);
            expect(memory.id).toBe(123);
        });

        it('sets sourceNpcId when provided', async () => {
            await service.createNpcMemory(7, 'Mira said the ruins are cursed.', 'Day 3', 12);

            expect(em.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                sourceNpcId: 12,
            }));
        });
    });

    describe('searchNpcMemories', () => {
        it('returns the top N results ordered by similarity', async () => {
            em = makeEntityManager([
                {
                    id: 1,
                    npcId: 7,
                    content: 'Closest match',
                    inGameDate: 'Day 2',
                    sourceNpcId: null,
                    createdAt: new Date('2026-04-01T00:00:00Z'),
                    score: '0.01',
                },
                {
                    id: 2,
                    npcId: 7,
                    content: 'Second match',
                    inGameDate: 'Day 1',
                    sourceNpcId: 9,
                    createdAt: new Date('2026-04-02T00:00:00Z'),
                    score: '0.15',
                },
            ]);
            embeddingService = makeEmbeddingService([0.2, 0.4]);
            service = new NpcMemoryService(em as never, embeddingService as never);

            const results = await service.searchNpcMemories(7, 'bandits', 2);

            expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('bandits');
            expect(em.connection.execute).toHaveBeenCalledWith(expect.stringContaining('from npc_memory'), [
                '[0.2,0.4]',
                7,
                2,
            ]);
            expect(results.map((result) => result.content)).toEqual(['Closest match', 'Second match']);
            expect(results[0]?.score).toBe(0.01);
        });

        it('returns an empty array when no memories exist', async () => {
            em = makeEntityManager([]);
            service = new NpcMemoryService(em as never, embeddingService as never);

            await expect(service.searchNpcMemories(7, 'bandits', 3)).resolves.toEqual([]);
        });

        it('respects the requested limit', async () => {
            await service.searchNpcMemories(7, 'bandits', 999);

            expect(em.connection.execute).toHaveBeenCalledWith(expect.any(String), [
                '[0.1,0.2]',
                7,
                20,
            ]);
        });
    });
});
