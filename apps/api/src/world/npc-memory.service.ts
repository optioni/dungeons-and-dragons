import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { EmbeddingService } from '../memory/embedding.service.js';
import { NpcMemory } from './entities/npc-memory.entity.js';

export interface NpcMemorySearchResult {
    id: number
    npcId: number
    content: string
    inGameDate: string | null
    sourceNpcId: number | null
    createdAt: Date
    score: number
}

interface CreateNpcMemoryOptions {
    flush?: boolean
}

interface RawNpcMemoryRow {
    id: number
    npcId: number
    content: string
    inGameDate: string | null
    sourceNpcId: number | null
    createdAt: Date
    score: number | string
}

/**
 * Persists and semantically retrieves episodic memories scoped to a single NPC.
 */
@Injectable()
export class NpcMemoryService {
    constructor(
        private readonly em: EntityManager,
        private readonly embeddingService: EmbeddingService,
    ) {}

    /**
     * Creates an episodic memory row for an NPC and generates its embedding.
     * Flushes by default; callers participating in a larger atomic batch may disable it.
     */
    async createNpcMemory(
        npcId: number,
        content: string,
        inGameDate?: string,
        sourceNpcId?: number,
        options: CreateNpcMemoryOptions = {},
    ): Promise<NpcMemory> {
        const truncated = content.slice(0, 1000);
        const embedding = await this.embeddingService.generateEmbedding(truncated);

        const memory = this.em.create(NpcMemory, {
            npcId,
            content: truncated,
            embedding,
            inGameDate: inGameDate ?? null,
            sourceNpcId: sourceNpcId ?? null,
        });

        this.em.persist(memory);
        if (options.flush ?? true) {
            await this.em.flush();
        }

        return memory;
    }

    /**
     * Retrieves the most semantically relevant memories for a single NPC by cosine distance.
     */
    async searchNpcMemories(
        npcId: number,
        query: string,
        limit: number,
    ): Promise<NpcMemorySearchResult[]> {
        const effectiveLimit = Math.min(Math.max(limit, 1), 20);
        const embedding = await this.embeddingService.generateEmbedding(query);
        if (!embedding) {
            return [];
        }

        const rows = await this.em.getConnection().execute<RawNpcMemoryRow[]>(
            `select id,
                    npc_id as "npcId",
                    content,
                    in_game_date as "inGameDate",
                    source_npc_id as "sourceNpcId",
                    created_at as "createdAt",
                    (embedding <=> ?::vector) as score
             from npc_memory
             where npc_id = ?
               and embedding is not null
             order by score asc
             limit ?`,
            [`[${embedding.join(',')}]`, npcId, effectiveLimit],
        );

        return rows.map((row) => ({
            ...row,
            score: Number(row.score),
        }));
    }
}
