// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig, type EntityManager } from '@mikro-orm/postgresql';
import Redis from 'ioredis';
import {
    afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { EmbeddingService } from '../memory/embedding.service';
import { DiaryEntry } from '../memory/entities/diary-entry.entity';
import { Memory } from '../memory/entities/memory.entity';
import { MemoryService } from '../memory/memory.service';
import { Faction } from './entities/faction.entity';
import { LocationDiscovery } from './entities/location-discovery.entity';
import { Location } from './entities/location.entity';
import { MapLocation } from './entities/map-location.entity';
import { Map as WorldMap } from './entities/map.entity';
import { NpcItem } from './entities/npc-item.entity';
import { NpcMemory } from './entities/npc-memory.entity';
import { NpcRelationship } from './entities/npc-relationship.entity';
import { Npc } from './entities/npc.entity';
import { WorldEvent } from './entities/world-event.entity';
import { NpcMemoryService } from './npc-memory.service';
import { WorldTickWorker } from './world-tick.worker';
import { WorldEventSource, WorldEventStatus } from './world.enums';
import { WorldService } from './world.service';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://dnd:dnd@localhost:5432/dnd';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const ALL_ENTITIES = [
    User,
    Campaign,
    DiaryEntry,
    Memory,
    Location,
    WorldMap,
    MapLocation,
    LocationDiscovery,
    Faction,
    WorldEvent,
    Npc,
    NpcMemory,
    NpcRelationship,
    NpcItem,
];

function buildMemoryService(em: EntityManager): MemoryService {
    const embedClient = {
        embed: vi.fn().mockResolvedValue({ data: [{ embedding: Array.from({ length: 1024 }, () => 0.01) }] }),
    };
    const embeddingService = new EmbeddingService(embedClient as never);
    const anthropicClient = {
        messages: {
            create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'World tick diary.' }],
            }),
        },
    };
    return new MemoryService(em, embeddingService, anthropicClient as never, 'stub-model');
}

function buildWorldService(em: EntityManager): WorldService {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const makeRepo = (_entity: unknown) => ({
        createQueryBuilder: vi.fn(),
        getEntityManager: () => em,
        find: (...args: unknown[]) => (em as unknown as { find: (...a: unknown[]) => unknown }).find(...args),
        findOne: (...args: unknown[]) => (em as unknown as { findOne: (...a: unknown[]) => unknown }).findOne(...args),
    }) as never;

    return new WorldService(
        makeRepo(Location),
        makeRepo(WorldMap),
        makeRepo(Faction),
        makeRepo(WorldEvent),
        makeRepo(Npc),
        makeRepo(NpcRelationship),
        makeRepo(NpcItem),
        makeRepo(Campaign),
    );
}

function buildWorker(
    em: EntityManager,
    redis: Redis,
    anthropicMessages: { create: ReturnType<typeof vi.fn> },
): WorldTickWorker {
    const worldService = buildWorldService(em);
    const memoryService = buildMemoryService(em.fork());
    const embedClient = {
        embed: vi.fn().mockResolvedValue({ data: [{ embedding: Array.from({ length: 1024 }, () => 0.01) }] }),
    };
    const npcMemoryService = new NpcMemoryService(em.fork(), new EmbeddingService(embedClient as never));
    const config = { get: vi.fn().mockReturnValue(10) };

    return new WorldTickWorker(
        em,
        worldService,
        memoryService,
        npcMemoryService,
        redis,
        { messages: anthropicMessages } as never,
        'stub-model',
        config as never,
    );
}

describe('WorldTickWorker integration', () => {
    let orm: MikroORM;
    let em: EntityManager;
    let redis: Redis;
    let campaignId: number;
    let userId: number;

    beforeEach(async () => {
        orm = await MikroORM.init(
            defineConfig({
                clientUrl: DB_URL,
                entities: ALL_ENTITIES,
            }),
        );
        em = orm.em.fork() as EntityManager;
        redis = new Redis(REDIS_URL);

        const user = em.create(User, { email: `ticktest-${Date.now()}@test.com`, passwordHash: 'x' });
        em.persist(user);
        await em.flush();
        userId = user.id;

        const campaign = em.create(Campaign, {
            userId,
            name: 'World Tick Integration Test',
            inGameDate: 'Day 5',
            inGameDay: 5,
        });
        em.persist(campaign);
        await em.flush();
        campaignId = campaign.id;
    });

    afterEach(async () => {
        await redis.del(`campaignLocked:${campaignId}`);
        await redis.quit();

        const conn = em.getConnection();
        await conn.execute('DELETE FROM diary_entry WHERE campaign_id = $1', [campaignId]);
        await conn.execute('DELETE FROM npc_memory WHERE npc_id IN (SELECT id FROM npc WHERE campaign_id = $1)', [campaignId]);
        await conn.execute('DELETE FROM npc_item WHERE npc_id IN (SELECT id FROM npc WHERE campaign_id = $1)', [campaignId]);
        await conn.execute('DELETE FROM npc_relationship WHERE source_npc_id IN (SELECT id FROM npc WHERE campaign_id = $1)', [campaignId]);
        await conn.execute('DELETE FROM npc WHERE campaign_id = $1', [campaignId]);
        await conn.execute('DELETE FROM world_event WHERE campaign_id = $1', [campaignId]);
        await conn.execute('DELETE FROM location_discovery WHERE campaign_id = $1', [campaignId]);
        await conn.execute('DELETE FROM location WHERE campaign_id = $1', [campaignId]);
        await conn.execute('DELETE FROM campaign WHERE id = $1', [campaignId]);
        await conn.execute('DELETE FROM "user" WHERE id = $1', [userId]);
        await orm.close();
    });

    // ── 9.1: overdue NPC agenda is updated ───────────────────────────────────

    it('enqueues a world-tick job — overdue NPC agenda fields are updated and diary entry is created', async () => {
        const workerEm = em.fork();

        const npc = workerEm.create(Npc, {
            campaignId,
            name: 'Gareth',
            personalityTraits: ['brave'],
            agenda: 'gather supplies',
            // overdue — Day 3 ≤ Day 5
            nextTickInGameDay: 3,
        });
        workerEm.persist(npc);
        await workerEm.flush();

        const anthropicMessages = {
            create: vi.fn().mockImplementation(async (options: { tools?: unknown[] }) => {
                if (options.tools) {
                    // catastrophe roll — don't trigger
                    return { content: [] };
                }

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            agenda: 'escort the merchant to Millhaven',
                            nextTickInGameDay: 9,
                            newLocationId: null,
                            departureDescription: null,
                        }),
                    }],
                };
            }),
        };

        const worker = buildWorker(workerEm, redis, anthropicMessages);
        const result = await worker.process({ data: { campaignId } } as never);

        expect(result).toEqual({ status: 'ok' });

        const updatedNpc = await em.fork().findOne(Npc, { id: npc.id });
        expect(updatedNpc!.agenda).toBe('escort the merchant to Millhaven');
        expect(updatedNpc!.nextTickInGameDay).toBe(9);

        const diary = await em.fork().findOne(DiaryEntry, { campaign: { id: campaignId } });
        expect(diary).not.toBeNull();
    });

    // ── 9.2: concurrent ticks — second exits as no-op ────────────────────────

    it('enqueues two concurrent world-tick jobs — the second exits as no-op when lock is held', async () => {
        const workerEm = em.fork();
        const lockKey = `campaignLocked:${campaignId}`;

        // Pre-acquire the lock to simulate a running job
        await redis.set(lockKey, '1', 'EX', 600, 'NX');

        const anthropicMessages = { create: vi.fn() };
        const worker = buildWorker(workerEm, redis, anthropicMessages);

        const result = await worker.process({ data: { campaignId } } as never);

        expect(result).toEqual({ status: 'skipped' });
        expect(anthropicMessages.create).not.toHaveBeenCalled();
    });

    // ── 9.3: NPC movement produces a departure WorldEvent ────────────────────

    it('NPC with newLocationId outcome produces departure WorldEvent at old location and updates currentLocationId', async () => {
        const workerEm = em.fork();

        const location1 = workerEm.create(Location, {
            campaignId,
            name: 'Millhaven',
            description: 'A market town',
            currentState: 'peaceful',
        });
        const location2 = workerEm.create(Location, {
            campaignId,
            name: 'The Dark Forest',
            description: 'A dangerous woodland',
            currentState: 'ominous',
        });
        workerEm.persist(location1);
        workerEm.persist(location2);
        await workerEm.flush();

        const npc = workerEm.create(Npc, {
            campaignId,
            name: 'Gareth',
            personalityTraits: ['secretive'],
            agenda: 'flee town',
            nextTickInGameDay: 2,
            currentLocationId: location1.id,
        });
        workerEm.persist(npc);
        await workerEm.flush();

        const anthropicMessages = {
            create: vi.fn().mockImplementation(async (options: { tools?: unknown[] }) => {
                if (options.tools) {
                    // catastrophe roll
                    return { content: [] };
                }

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            agenda: 'hiding in the forest',
                            nextTickInGameDay: 10,
                            newLocationId: location2.id,
                            departureDescription: 'Gareth slipped out before dawn, heading toward the forest.',
                        }),
                    }],
                };
            }),
        };

        const worker = buildWorker(workerEm, redis, anthropicMessages);
        await worker.process({ data: { campaignId } } as never);

        const updatedNpc = await em.fork().findOne(Npc, { id: npc.id });
        expect(updatedNpc!.currentLocationId).toBe(location2.id);

        const departureEvent = await em.fork().findOne(WorldEvent, {
            campaignId,
            locationId: location1.id,
            source: WorldEventSource.WORLD_TICK,
        });
        expect(departureEvent).not.toBeNull();
        expect(departureEvent!.description).toContain('Gareth');
        expect(departureEvent!.status).toBe(WorldEventStatus.ACTIVE);
    });
});
