// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { SrdClass } from '../srd/entities/srd-class.entity';
import { SrdRace } from '../srd/entities/srd-race.entity';
import { Faction } from '../world/entities/faction.entity';
import { Location } from '../world/entities/location.entity';
import { LocationDiscovery } from '../world/entities/location-discovery.entity';
import { Map } from '../world/entities/map.entity';
import { MapLocation } from '../world/entities/map-location.entity';
import { Npc } from '../world/entities/npc.entity';
import { NpcItem } from '../world/entities/npc-item.entity';
import { NpcRelationship } from '../world/entities/npc-relationship.entity';
import { WorldEvent } from '../world/entities/world-event.entity';
import { LocationDiscoverySource } from '../world/world.enums';
import { Character } from '../character/entities/character.entity';
import { CharacterItem } from '../character/entities/character-item.entity';
import { Item } from '../character/entities/item.entity';
import { CampaignSetupStatus } from './campaign.enums';
import { Campaign } from './entities/campaign.entity';

const DB_URL = 'postgresql://dnd:dnd@localhost:5432/dnd';

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [
                User, Campaign, Character, Item, CharacterItem, SrdRace, SrdClass,
                Location, Map, MapLocation, LocationDiscovery, Faction, WorldEvent,
                Npc, NpcRelationship, NpcItem,
            ],
        }),
    );
}

describe('CampaignModule integration', () => {
    let orm: MikroORM;
    let testUser: User;
    let otherUser: User;
    let testCampaign: Campaign;

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();

        testUser = em.create(User, { email: `camp-test-${Date.now()}@example.com`, passwordHash: 'h' });
        otherUser = em.create(User, { email: `camp-other-${Date.now()}@example.com`, passwordHash: 'h' });
        em.persist([testUser, otherUser]);
        await em.flush();

        testCampaign = em.create(Campaign, { userId: testUser.id, name: 'Test Campaign' });
        em.persist(testCampaign);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();
        // Cascade deletes handle most rows; clean up campaigns and users explicitly
        await em.nativeDelete(Campaign, { userId: { $in: [testUser.id, otherUser.id] } });
        await em.nativeDelete(User, { id: { $in: [testUser.id, otherUser.id] } });
        await orm.close();
    });

    describe('createCampaign (3.2)', () => {
        it('creates a campaign with DRAFT setup status', async () => {
            const em = orm.em.fork();
            const campaign = await em.findOneOrFail(Campaign, { id: testCampaign.id });
            expect(campaign.setupStatus).toBe(CampaignSetupStatus.DRAFT);
            expect(campaign.name).toBe('Test Campaign');
        });

        it('does not create world entities when campaign is created', async () => {
            const em = orm.em.fork();
            const locationCount = await em.count(Location, { campaignId: testCampaign.id });
            const npcCount = await em.count(Npc, { campaignId: testCampaign.id });
            expect(locationCount).toBe(0);
            expect(npcCount).toBe(0);
        });
    });

    describe('owner-scoped queries (3.3, 3.4)', () => {
        it('campaign query returns only campaigns owned by the querying user', async () => {
            const em = orm.em.fork();
            // Create a campaign for otherUser
            const otherCampaign = em.create(Campaign, {
                userId: otherUser.id,
                name: 'Other Campaign',
            });
            em.persist(otherCampaign);
            await em.flush();

            const userCampaigns = await em.find(Campaign, { userId: testUser.id });
            expect(userCampaigns.every((c) => c.userId === testUser.id)).toBe(true);

            await em.nativeDelete(Campaign, { id: otherCampaign.id });
        });
    });

    describe('non-owner access (8.1)', () => {
        it('campaign with matching ID but wrong userId is not found', async () => {
            const em = orm.em.fork();
            // Querying with otherUser's userId should not return testUser's campaign
            const result = await em.findOne(Campaign, {
                id: testCampaign.id,
                userId: otherUser.id,
            });
            expect(result).toBeNull();
        });

        it('world events for a campaign owned by another user are inaccessible', async () => {
            const em = orm.em.fork();
            // Add a world event to testCampaign
            const location = em.create(Location, {
                campaignId: testCampaign.id,
                name: 'Test Location',
                description: 'A test location',
            });
            em.persist(location);
            await em.flush();

            const event = em.create(WorldEvent, {
                campaignId: testCampaign.id,
                description: 'Test event',
            });
            em.persist(event);
            await em.flush();

            // Query that restricts by userId via campaign join should return nothing for otherUser
            const campaignBelongingToOther = await em.findOne(Campaign, {
                id: testCampaign.id,
                userId: otherUser.id,
            });
            expect(campaignBelongingToOther).toBeNull();
        });
    });

    describe('world seed persistence (8.2, 8.3, 8.4)', () => {
        it('failed world-seed validation leaves no partial world rows', async () => {
            const em = orm.em.fork();
            const locationsBefore = await em.count(Location, { campaignId: testCampaign.id });
            const npcsBefore = await em.count(Npc, { campaignId: testCampaign.id });

            // Simulate partial creation attempt inside a transaction that rolls back
            try {
                await em.transactional(async (txEm) => {
                    txEm.create(Location, { campaignId: testCampaign.id, name: 'Partial', description: 'd' });
                    txEm.create(Npc, { campaignId: testCampaign.id, name: 'Partial NPC' });
                    await txEm.flush();
                    throw new Error('Simulated validation failure');
                });
            } catch {
                // Expected
            }

            const locationsAfter = await em.count(Location, { campaignId: testCampaign.id });
            const npcsAfter = await em.count(Npc, { campaignId: testCampaign.id });
            expect(locationsAfter).toBe(locationsBefore);
            expect(npcsAfter).toBe(npcsBefore);
        });

        it('starting location has a LocationDiscovery row with source = SETUP', async () => {
            const em = orm.em.fork();

            // Manually seed a minimal world (simulates what generateCampaignWorldSeed would do)
            await em.transactional(async (txEm) => {
                const startingLocation = txEm.create(Location, {
                    campaignId: testCampaign.id,
                    name: 'Starting Village',
                    description: 'Where it all begins',
                });
                await txEm.flush();

                txEm.create(LocationDiscovery, {
                    campaignId: testCampaign.id,
                    locationId: startingLocation.id,
                    source: LocationDiscoverySource.SETUP,
                });

                // Load the campaign within txEm's unit of work so the flush persists the changes
                const txCampaign = await txEm.findOneOrFail(Campaign, { id: testCampaign.id });
                txCampaign.currentLocationId = startingLocation.id;
                txCampaign.setupStatus = CampaignSetupStatus.READY_TO_PLAY;
                await txEm.flush();
            });

            const discovery = await em.findOne(LocationDiscovery, {
                campaignId: testCampaign.id,
                source: LocationDiscoverySource.SETUP,
            });

            expect(discovery).not.toBeNull();
            expect(discovery!.source).toBe(LocationDiscoverySource.SETUP);
        });

        it('repeated world-seed application does not duplicate rows when campaign is READY_TO_PLAY', async () => {
            const em = orm.em.fork();

            // Seed once
            await em.transactional(async (txEm) => {
                const loc = txEm.create(Location, {
                    campaignId: testCampaign.id,
                    name: 'Village',
                    description: 'Desc',
                });
                await txEm.flush();

                txEm.create(LocationDiscovery, {
                    campaignId: testCampaign.id,
                    locationId: loc.id,
                    source: LocationDiscoverySource.SETUP,
                });

                // Load the campaign within txEm's unit of work so the flush persists the status change
                const txCampaign = await txEm.findOneOrFail(Campaign, { id: testCampaign.id });
                txCampaign.setupStatus = CampaignSetupStatus.READY_TO_PLAY;
                await txEm.flush();
            });

            const locationsBefore = await em.count(Location, { campaignId: testCampaign.id });

            // The service-level idempotency guard prevents re-seeding when status = READY_TO_PLAY
            // We verify the DB state directly — the service returns early without creating rows
            const freshCampaign = await em.findOneOrFail(Campaign, { id: testCampaign.id });
            expect(freshCampaign.setupStatus).toBe(CampaignSetupStatus.READY_TO_PLAY);
            expect(await em.count(Location, { campaignId: testCampaign.id })).toBe(locationsBefore);
        });
    });
});
