import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import type Anthropic from '@anthropic-ai/sdk';

import { EventType } from '../session/session.enums.js';
import type { GameEvent } from '../session/entities/game-event.entity.js';
import { DiaryEntry } from './entities/diary-entry.entity.js';
import { Memory, SubjectType } from './entities/memory.entity.js';
import { EmbeddingService } from './embedding.service.js';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');
export const BACKGROUND_MODEL = Symbol('BACKGROUND_MODEL');

export interface MemorySearchResult {
    type: 'diary' | 'fact';
    content: string;
    score: number;
    subjectType?: string;
    subjectId?: string;
    inGameDate?: string;
}

interface SearchOptions {
    subjectType?: SubjectType;
    subjectId?: string;
    limit?: number;
}

const VALID_SUBJECT_TYPES = new Set<string>(Object.values(SubjectType));

@Injectable()
export class MemoryService {
    private readonly logger = new Logger(MemoryService.name);

    constructor(
        private readonly em: EntityManager,
        private readonly embeddingService: EmbeddingService,
        @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Pick<Anthropic, 'messages'>,
        @Inject(BACKGROUND_MODEL) private readonly backgroundModel: string,
    ) {}

    /**
     * Calls Haiku to write a diary narrative from today's game events, generates an
     * embedding, and persists the DiaryEntry. Called by take_long_rest before world tick.
     */
    async writeDiaryEntry(campaignId: number, inGameDate: string, gameEvents: GameEvent[]): Promise<void> {
        const eventSummary = this.formatEventsForDiary(gameEvents);

        let content: string;
        try {
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 300,
                messages: [
                    {
                        role: 'user',
                        content: `Summarize today's D&D session as a concise diary entry (max 150 words, first person, from the adventurer's perspective).\n\nEvents from today:\n${eventSummary}`,
                    },
                ],
            });
            const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
                | { type: 'text'; text: string }
                | undefined;
            content = textBlock?.text ?? eventSummary;
        } catch (error) {
            this.logger.error('Haiku diary generation failed', error);
            content = eventSummary;
        }

        const truncated = content.slice(0, 1000);
        const embedding = await this.embeddingService.generateEmbedding(truncated);

        const entry = this.em.create(DiaryEntry, {
            campaign: { id: campaignId } as never,
            inGameDate,
            content: truncated,
            embedding,
        });

        await this.em.persistAndFlush(entry);
    }

    /** Returns the N most recent diary entries for a campaign, ordered newest-first. */
    async getRecentDiaryEntries(campaignId: number, limit = 7): Promise<DiaryEntry[]> {
        return this.em.find(
            DiaryEntry,
            { campaign: { id: campaignId } },
            { orderBy: { createdAt: 'DESC' }, limit },
        );
    }

    /** Persists a discrete memory fact; generates embedding when possible. */
    async createMemory(
        campaignId: number,
        subjectType: SubjectType,
        content: string,
        subjectId?: string,
    ): Promise<Memory> {
        if (!VALID_SUBJECT_TYPES.has(subjectType)) {
            throw new Error(`Invalid subjectType: ${subjectType}`);
        }

        const embedding = await this.embeddingService.generateEmbedding(content);

        const memory = this.em.create(Memory, {
            campaign: { id: campaignId } as never,
            subjectType,
            subjectId: subjectId ?? null,
            content,
            embedding,
        });

        await this.em.persistAndFlush(memory);
        return memory;
    }

    /**
     * Semantic search across diary entries and memory facts. Falls back to full-text
     * search when the embedding call fails or vector search returns no results.
     */
    async searchMemories(
        campaignId: number,
        query: string,
        options: SearchOptions = {},
    ): Promise<MemorySearchResult[]> {
        const { subjectType, subjectId, limit = 5 } = options;
        const effectiveLimit = Math.min(limit, 20);

        const conn = this.em.getConnection();

        // When subject type filter is applied, skip diary search
        const skipDiary = Boolean(subjectType);

        const embedding = await this.embeddingService.generateEmbedding(query);

        let diaryRows: MemorySearchResult[] = [];
        let memoryRows: MemorySearchResult[] = [];

        if (embedding) {
            const embeddingStr = `[${embedding.join(',')}]`;

            if (!skipDiary) {
                const diaryResults = await conn.execute<RawSearchRow[]>(
                    `SELECT 'diary' as type, id, content, in_game_date as "inGameDate",
                            NULL as "subjectType", NULL as "subjectId",
                            (embedding <=> $1::vector) as score
                     FROM diary_entry
                     WHERE campaign_id = $2 AND embedding IS NOT NULL
                     ORDER BY score ASC
                     LIMIT $3`,
                    [embeddingStr, campaignId, effectiveLimit],
                );
                diaryRows = diaryResults.map(mapRow);
            }

            const memoryParams: unknown[] = [embeddingStr, campaignId, effectiveLimit];
            let memoryFilter = 'embedding IS NOT NULL';
            if (subjectType) {
                memoryParams.push(subjectType);
                memoryFilter += ` AND subject_type = $${memoryParams.length}`;
            }
            if (subjectId) {
                memoryParams.push(subjectId);
                memoryFilter += ` AND subject_id = $${memoryParams.length}`;
            }

            const memoryResults = await conn.execute<RawSearchRow[]>(
                `SELECT 'fact' as type, id, content, NULL as "inGameDate",
                        subject_type as "subjectType", subject_id::text as "subjectId",
                        (embedding <=> $1::vector) as score
                 FROM memory
                 WHERE campaign_id = $2 AND ${memoryFilter}
                 ORDER BY score ASC
                 LIMIT $3`,
                memoryParams,
            );
            memoryRows = memoryResults.map(mapRow);
        }

        // If vector search returned results, merge and return
        if (diaryRows.length > 0 || memoryRows.length > 0) {
            return mergeAndLimit([...diaryRows, ...memoryRows], effectiveLimit);
        }

        // Full-text fallback
        return this.fullTextSearch(campaignId, query, options);
    }

    private async fullTextSearch(
        campaignId: number,
        query: string,
        options: SearchOptions,
    ): Promise<MemorySearchResult[]> {
        const { subjectType, subjectId, limit = 5 } = options;
        const effectiveLimit = Math.min(limit, 20);
        const conn = this.em.getConnection();
        const tsQuery = query.trim().split(/\s+/).join(' & ');

        let diaryRows: MemorySearchResult[] = [];

        if (!subjectType) {
            const diaryResults = await conn.execute<RawSearchRow[]>(
                `SELECT 'diary' as type, id, content, in_game_date as "inGameDate",
                        NULL as "subjectType", NULL as "subjectId",
                        ts_rank(search_vector, to_tsquery('english', $1)) as score
                 FROM diary_entry
                 WHERE campaign_id = $2
                   AND search_vector @@ to_tsquery('english', $1)
                 ORDER BY score DESC
                 LIMIT $3`,
                [tsQuery, campaignId, effectiveLimit],
            );
            diaryRows = diaryResults.map(mapRow);
        }

        const memoryParams: unknown[] = [tsQuery, campaignId, effectiveLimit];
        let memoryFilter = '';
        if (subjectType) {
            memoryParams.push(subjectType);
            memoryFilter += ` AND subject_type = $${memoryParams.length}`;
        }
        if (subjectId) {
            memoryParams.push(subjectId);
            memoryFilter += ` AND subject_id = $${memoryParams.length}`;
        }

        const memoryResults = await conn.execute<RawSearchRow[]>(
            `SELECT 'fact' as type, id, content, NULL as "inGameDate",
                    subject_type as "subjectType", subject_id::text as "subjectId",
                    ts_rank(search_vector, to_tsquery('english', $1)) as score
             FROM memory
             WHERE campaign_id = $2
               AND search_vector @@ to_tsquery('english', $1)
               ${memoryFilter}
             ORDER BY score DESC
             LIMIT $3`,
            memoryParams,
        );
        const memoryRows = memoryResults.map(mapRow);

        return mergeAndLimit([...diaryRows, ...memoryRows], effectiveLimit);
    }

    private formatEventsForDiary(events: GameEvent[]): string {
        const lines = events
            .filter((e) => e.eventType === EventType.PLAYER_INPUT || e.eventType === EventType.DM_NARRATIVE)
            .map((e) => {
                const c = e.content as Record<string, unknown>;
                return e.eventType === EventType.PLAYER_INPUT
                    ? `Player: ${String(c['text'] ?? '')}`
                    : `DM: ${String(c['narrative'] ?? '')}`;
            });

        return lines.length > 0 ? lines.join('\n') : '(No events recorded)';
    }
}

interface RawSearchRow {
    type: string;
    id: number;
    content: string;
    inGameDate: string | null;
    subjectType: string | null;
    subjectId: string | null;
    score: number;
}

function mapRow(row: RawSearchRow): MemorySearchResult {
    const result: MemorySearchResult = {
        type: row.type as 'diary' | 'fact',
        content: row.content,
        score: Number(row.score),
    };
    if (row.inGameDate) result.inGameDate = row.inGameDate;
    if (row.subjectType) result.subjectType = row.subjectType;
    if (row.subjectId) result.subjectId = row.subjectId;
    return result;
}

function mergeAndLimit(rows: MemorySearchResult[], limit: number): MemorySearchResult[] {
    return rows.sort((a, b) => a.score - b.score).slice(0, limit);
}
