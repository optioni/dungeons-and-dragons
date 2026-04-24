// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig, type EntityManager } from '@mikro-orm/postgresql';
import { LazyMetadataStorage } from '@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage.js';
import { TypeMetadataStorage } from '@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage.js';
import {
    afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { getRequiredIntegrationDatabaseUrl } from '../test-integration-environment.js';
import { EmbeddingService } from './embedding.service';
import { DiaryEntry } from './entities/diary-entry.entity';
import { Memory, SubjectType } from './entities/memory.entity';
import { MemoryService } from './memory.service';

const DB_URL = getRequiredIntegrationDatabaseUrl();

/** 1024-dim fixed embedding used so all records share the same cosine space. */
const FIXED_EMBEDDING = Array.from({ length: 1024 }, (_, index) => (index % 10) * 0.01);

function buildService(
    em: EntityManager,
    options: { embedding?: number[] | null } = {},
): MemoryService {
    const embedding = 'embedding' in options ? options.embedding : FIXED_EMBEDDING;
    const embedClient = { embed: vi.fn().mockResolvedValue({ data: [{ embedding }] }) };
    const embeddingService = new EmbeddingService(embedClient as never);

    const anthropicClient = {
        messages: {
            create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'A day of brave adventuring.' }],
            }),
        },
    };

    return new MemoryService(em, embeddingService, anthropicClient as never, 'stub-model');
}

describe('MemoryService integration', () => {
    let orm: MikroORM;
    let em: EntityManager;
    let campaignId: number;
    let userId: number;

    beforeEach(async () => {
        orm = await MikroORM.init(
            defineConfig({
                clientUrl: DB_URL,
                entities: [User, Campaign, DiaryEntry, Memory],
            }),
        );
        em = orm.em.fork() as EntityManager;

        // Create prerequisite rows
        const user = em.create(User, {
            email: `memtest-${Date.now()}@test.com`,
            passwordHash: 'x',
        });
        em.persist(user);
        await em.flush();
        userId = user.id;

        const campaign = em.create(Campaign, {
            userId,
            name: 'MemoryService Integration Test Campaign',
            inGameDate: 'Day 5',
        });
        em.persist(campaign);
        await em.flush();
        campaignId = campaign.id;
    });

    afterEach(async () => {
        const conn = em.getConnection();
        await conn.execute('DELETE FROM diary_entry WHERE campaign_id = ?', [campaignId]);
        await conn.execute('DELETE FROM memory WHERE campaign_id = ?', [campaignId]);
        await conn.execute('DELETE FROM campaign WHERE id = ?', [campaignId]);
        await conn.execute('DELETE FROM "user" WHERE id = ?', [userId]);
        await orm.close();
    });

    // ── 11.1: writeDiaryEntry persists DiaryEntry ─────────────────────────────

    describe('take_long_rest → diary creation', () => {
        it('writeDiaryEntry creates a DiaryEntry record for the active campaign', async () => {
            const service = buildService(em.fork());

            await service.writeDiaryEntry(campaignId, 'Day 5', []);

            const entry = await em.fork().findOne(DiaryEntry, { campaign: { id: campaignId } });
            expect(entry).not.toBeNull();
            expect(entry!.inGameDate).toBe('Day 5');
            expect(entry!.content.length).toBeGreaterThan(0);
        });

        it('persists DiaryEntry with null embedding when embedding service returns null', async () => {
            const service = buildService(em.fork(), { embedding: null });

            await service.writeDiaryEntry(campaignId, 'Day 5', []);

            const entry = await em.fork().findOne(DiaryEntry, { campaign: { id: campaignId } });
            expect(entry).not.toBeNull();
            expect(entry!.embedding).toBeNull();
            expect(entry!.content.length).toBeGreaterThan(0);
        });
    });

    // ── 11.2: record_memory persists Memory record ────────────────────────────

    describe('record_memory tool call', () => {
        it('createMemory persists a Memory record with the correct subjectType', async () => {
            const service = buildService(em.fork());

            await service.createMemory(
                campaignId,
                SubjectType.NPC,
                'The goblin chief has a distinctive scar across his face.',
                '00000000-0000-4000-8000-000000000001',
            );

            const fork = em.fork();
            const memory = await fork.findOne(Memory, { campaign: { id: campaignId } });
            expect(memory).not.toBeNull();
            expect(memory!.subjectType).toBe(SubjectType.NPC);
            expect(memory!.subjectId).toBe('00000000-0000-4000-8000-000000000001');
            expect(memory!.content).toContain('goblin chief');
        });
    });

    // ── 11.3: search_memories returns results from both tables ────────────────

    describe('search_memories vector search', () => {
        it('returns results from both diary and memory tables ranked by similarity', async () => {
            // Insert one record of each type
            const service = buildService(em.fork());
            await service.writeDiaryEntry(campaignId, 'Day 4', []);
            await service.createMemory(campaignId, SubjectType.GENERAL, 'The tavern keeper knows secrets.', undefined);

            // Search with the same fixed embedding so all records match
            const searchService = buildService(em.fork());
            const results = await searchService.searchMemories(campaignId, 'test query', { limit: 10 });

            expect(results.length).toBeGreaterThanOrEqual(2);
            const types = results.map((result) => result.type);
            expect(types).toContain('diary');
            expect(types).toContain('fact');
        });
    });

    // ── 2.2: getRecentDiaryEntries ordering and owner scoping ─────────────────
    describe('getRecentDiaryEntries', () => {
        it('returns entries newest-first up to the requested limit', async () => {
            const service = buildService(em.fork());

            // Write three entries — each flush increments createdAt slightly
            await service.writeDiaryEntry(campaignId, 'Day 1', []);
            await service.writeDiaryEntry(campaignId, 'Day 2', []);
            await service.writeDiaryEntry(campaignId, 'Day 3', []);

            const entries = await service.getRecentDiaryEntries(campaignId, 10);

            expect(entries.length).toBe(3);
            // Newest first: Day 3 should appear before Day 1
            const dates = entries.map((e) => e.inGameDate);
            expect(dates[0]).toBe('Day 3');
            expect(dates[2]).toBe('Day 1');
        });

        it('respects the limit argument', async () => {
            const service = buildService(em.fork());

            await service.writeDiaryEntry(campaignId, 'Day 1', []);
            await service.writeDiaryEntry(campaignId, 'Day 2', []);
            await service.writeDiaryEntry(campaignId, 'Day 3', []);

            const entries = await service.getRecentDiaryEntries(campaignId, 2);
            expect(entries.length).toBe(2);
        });

        it('returns empty list for a campaign with no diary entries', async () => {
            // Use a fresh campaign that has no entries
            const freshEm = em.fork();
            const user = freshEm.create(User, { email: `diary-scope-${Date.now()}@test.com`, passwordHash: 'x' });
            freshEm.persist(user);
            await freshEm.flush();

            const otherCampaign = freshEm.create(Campaign, { userId: user.id, name: 'Other' });
            freshEm.persist(otherCampaign);
            await freshEm.flush();

            const entries = await buildService(freshEm.fork()).getRecentDiaryEntries(otherCampaign.id, 10);
            expect(entries).toHaveLength(0);

            await freshEm.nativeDelete(Campaign, { id: otherCampaign.id });
            await freshEm.nativeDelete(User, { id: user.id });
        });
    });

    // ── 2.4: DiaryEntry does not expose embedding field via GraphQL ───────────
    describe('DiaryEntry GraphQL type safety', () => {
        it('does not expose embedding on the DiaryEntry GraphQL object type', async () => {
            const service = buildService(em.fork());
            await service.writeDiaryEntry(campaignId, 'Day 10', []);

            const entry = await em.fork().findOne(DiaryEntry, { campaign: { id: campaignId } });
            expect(entry).not.toBeNull();

            LazyMetadataStorage.load([DiaryEntry]);
            TypeMetadataStorage.compile([DiaryEntry]);
            const objectType = TypeMetadataStorage.getObjectTypeMetadataByTarget(DiaryEntry);
            const exposedFields = objectType?.properties?.map((property) => property.name) ?? [];

            expect((entry as unknown as Record<string, unknown>)['embedding']).toEqual(FIXED_EMBEDDING);
            expect(exposedFields).toContain('content');
            expect(exposedFields).not.toContain('embedding');
        });
    });

    // ── 11.4: search_memories falls back to full-text ─────────────────────────

    describe('search_memories full-text fallback', () => {
        it('returns results via full-text search when embedding generation returns null', async () => {
            // Insert a record with real content (trigger populates search_vector)
            const service = buildService(em.fork());
            await service.createMemory(
                campaignId,
                SubjectType.LOCATION,
                'The ancient ruins hide a sleeping dragon beneath rubble.',
                undefined,
            );

            // Search with null embedding → forces full-text fallback
            const searchService = buildService(em.fork(), { embedding: null });
            const results = await searchService.searchMemories(campaignId, 'dragon ruins');

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]!.content).toContain('dragon');
        });
    });
});
