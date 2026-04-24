import type Anthropic from '@anthropic-ai/sdk';

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type GameEvent } from '../session/entities/game-event.entity.js';
import { EventType } from '../session/session.enums.js';
import { EmbeddingService } from './embedding.service.js';
import { DiaryEntry, DiaryEntryType } from './entities/diary-entry.entity.js';
import { Memory, SubjectType } from './entities/memory.entity.js';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');
export const BACKGROUND_MODEL = Symbol('BACKGROUND_MODEL');

export interface MemorySearchResult {
    type: 'diary' | 'fact'
    content: string
    score: number
    subjectType?: string
    subjectId?: string
    inGameDate?: string
}

interface SearchOptions {
    subjectType?: SubjectType
    subjectId?: string
    limit?: number
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
     * Calls Haiku to write a diary narrative from today's game events (or a MEMORIAL entry
     * on permadeath), generates an embedding, and persists the DiaryEntry.
     * Memorial entries: failure is caught and logged — does not rethrow.
     */
    async writeDiaryEntry(
        campaignId: number,
        inGameDate: string,
        gameEvents: GameEvent[],
        entryType: DiaryEntryType = DiaryEntryType.DAILY,
    ): Promise<void> {
        const eventSummary = this.formatEventsForDiary(gameEvents);

        const prompt = entryType === DiaryEntryType.MEMORIAL
            ? `Write a memorial epitaph for this D&D character (max 150 words, third person, elegiac tone). Summarise the character's life, key deeds, and cause of death.\n\nSession transcript:\n${eventSummary}`
            : `Summarize today's D&D session as a concise diary entry (max 150 words, first person, from the adventurer's perspective).\n\nEvents from today:\n${eventSummary}`;

        let content: string;
        try {
            /* eslint-disable @typescript-eslint/naming-convention */
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 300,
                messages: [{ role: 'user', content: prompt }],
            });
            /* eslint-enable @typescript-eslint/naming-convention */
            const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as
                | { type: 'text'; text: string }
                | undefined;
            content = textBlock?.text ?? eventSummary;
        } catch (error) {
            this.logger.error('Haiku diary generation failed', error);
            if (entryType === DiaryEntryType.MEMORIAL) {
                return;
            }

            content = eventSummary;
        }

        const truncated = content.slice(0, 1000);
        const embedding = await this.embeddingService.generateEmbedding(truncated);

        const entry = this.em.create(DiaryEntry, {
            campaign: this.em.getReference(Campaign, campaignId),
            inGameDate,
            entryType,
            content: truncated,
            embedding,
        } as never);

        this.em.persist(entry);
        await this.em.flush();
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
            campaign: this.em.getReference(Campaign, campaignId),
            subjectType,
            subjectId: subjectId ?? null,
            content,
            embedding,
        } as never);

        this.em.persist(memory);
        await this.em.flush();
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
            const embeddingString = `[${embedding.join(',')}]`;

            if (!skipDiary) {
                const diaryResults = await conn.execute<RawSearchRow[]>(
                    `SELECT 'diary' as type, id, content, in_game_date as "inGameDate",
                            NULL as "subjectType", NULL as "subjectId",
                            (embedding <=> ?::vector) as score
                     FROM diary_entry
                     WHERE campaign_id = ? AND embedding IS NOT NULL
                     ORDER BY score ASC
                     LIMIT ?`,
                    [embeddingString, campaignId, effectiveLimit],
                );
                diaryRows = diaryResults.map(mapRow);
            }

            const memoryParameters: unknown[] = [embeddingString, campaignId];
            let memoryFilter = 'embedding IS NOT NULL';
            if (subjectType) {
                memoryParameters.push(subjectType);
                memoryFilter += ' AND subject_type = ?';
            }

            if (subjectId) {
                memoryParameters.push(subjectId);
                memoryFilter += ' AND subject_id = ?';
            }
            memoryParameters.push(effectiveLimit);

            const memoryResults = await conn.execute<RawSearchRow[]>(
                `SELECT 'fact' as type, id, content, NULL as "inGameDate",
                        subject_type as "subjectType", subject_id::text as "subjectId",
                        (embedding <=> ?::vector) as score
                 FROM memory
                 WHERE campaign_id = ? AND ${memoryFilter}
                 ORDER BY score ASC
                 LIMIT ?`,
                memoryParameters,
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
        const tsQuery = query.trim().split(/\s+/u).join(' & ');

        let diaryRows: MemorySearchResult[] = [];

        if (!subjectType) {
            const diaryResults = await conn.execute<RawSearchRow[]>(
                `SELECT 'diary' as type, id, content, in_game_date as "inGameDate",
                        NULL as "subjectType", NULL as "subjectId",
                        ts_rank(search_vector, to_tsquery('english', ?)) as score
                 FROM diary_entry
                 WHERE campaign_id = ?
                   AND search_vector @@ to_tsquery('english', ?)
                 ORDER BY score DESC
                 LIMIT ?`,
                [tsQuery, campaignId, tsQuery, effectiveLimit],
            );
            diaryRows = diaryResults.map(mapRow);
        }

        const memoryParameters: unknown[] = [tsQuery, campaignId, tsQuery];
        let memoryFilter = '';
        if (subjectType) {
            memoryParameters.push(subjectType);
            memoryFilter += ' AND subject_type = ?';
        }

        if (subjectId) {
            memoryParameters.push(subjectId);
            memoryFilter += ' AND subject_id = ?';
        }
        memoryParameters.push(effectiveLimit);

        const memoryResults = await conn.execute<RawSearchRow[]>(
            `SELECT 'fact' as type, id, content, NULL as "inGameDate",
                    subject_type as "subjectType", subject_id::text as "subjectId",
                    ts_rank(search_vector, to_tsquery('english', ?)) as score
             FROM memory
             WHERE campaign_id = ?
               AND search_vector @@ to_tsquery('english', ?)
               ${memoryFilter}
             ORDER BY score DESC
             LIMIT ?`,
            memoryParameters,
        );
        const memoryRows = memoryResults.map(mapRow);

        return mergeAndLimit([...diaryRows, ...memoryRows], effectiveLimit);
    }

    private formatEventsForDiary(events: GameEvent[]): string {
        const lines = events
            .filter((event) => event.eventType === EventType.PLAYER_INPUT || event.eventType === EventType.DM_NARRATIVE)
            .map((event) => {
                const content = event.content as Record<string, unknown>;
                return event.eventType === EventType.PLAYER_INPUT
                    ? `Player: ${String(content['text'] ?? '')}`
                    : `DM: ${String(content['narrative'] ?? '')}`;
            });

        return lines.length > 0 ? lines.join('\n') : '(No events recorded)';
    }
}

interface RawSearchRow {
    type: string
    id: number
    content: string
    inGameDate: string | null
    subjectType: string | null
    subjectId: string | null
    score: number
}

function mapRow(row: RawSearchRow): MemorySearchResult {
    const result: MemorySearchResult = {
        type: row.type as 'diary' | 'fact',
        content: row.content,
        score: Number(row.score),
    };
    if (row.inGameDate) {
        result.inGameDate = row.inGameDate;
    }

    if (row.subjectType) {
        result.subjectType = row.subjectType;
    }

    if (row.subjectId) {
        result.subjectId = row.subjectId;
    }

    return result;
}

function mergeAndLimit(rows: MemorySearchResult[], limit: number): MemorySearchResult[] {
    return rows.sort((a, b) => a.score - b.score).slice(0, limit);
}
