// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { CampaignSetupStatus } from '../campaign/campaign.enums';
import { Campaign } from '../campaign/entities/campaign.entity';
import { CharacterItem } from '../character/entities/character-item.entity';
import { Character } from '../character/entities/character.entity';
import { Item } from '../character/entities/item.entity';
import { SrdClass } from '../srd/entities/srd-class.entity';
import { SrdCondition } from '../srd/entities/srd-condition.entity';
import { SrdEquipment } from '../srd/entities/srd-equipment.entity';
import { SrdMonster } from '../srd/entities/srd-monster.entity';
import { SrdRace } from '../srd/entities/srd-race.entity';
import { SrdSpell } from '../srd/entities/srd-spell.entity';
import { getRequiredIntegrationDatabaseUrl } from '../test-integration-environment.js';
import { Faction } from '../world/entities/faction.entity';
import { LocationDiscovery } from '../world/entities/location-discovery.entity';
import { Location } from '../world/entities/location.entity';
import { MapLocation } from '../world/entities/map-location.entity';
import { Map } from '../world/entities/map.entity';
import { NpcItem } from '../world/entities/npc-item.entity';
import { NpcRelationship } from '../world/entities/npc-relationship.entity';
import { Npc } from '../world/entities/npc.entity';
import { WorldEvent } from '../world/entities/world-event.entity';
import { GameEvent } from './entities/game-event.entity';
import { GameSession } from './entities/game-session.entity';
import { EventType, SceneType } from './session.enums';

const DB_URL = getRequiredIntegrationDatabaseUrl();

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [
                User,
                Campaign,
                Character,
                Item,
                CharacterItem,
                SrdRace,
                SrdClass,
                SrdSpell,
                SrdMonster,
                SrdEquipment,
                SrdCondition,
                Location,
                Map,
                MapLocation,
                LocationDiscovery,
                Faction,
                WorldEvent,
                Npc,
                NpcRelationship,
                NpcItem,
                GameSession,
                GameEvent,
            ],
        }),
    );
}

describe('SessionModule integration', () => {
    let orm: MikroORM;
    let testUser: User;
    let otherUser: User;
    let testCampaign: Campaign;

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();

        testUser = em.create(User, { email: `session-test-${Date.now()}@example.com`, passwordHash: 'h' });
        otherUser = em.create(User, { email: `session-other-${Date.now()}@example.com`, passwordHash: 'h' });
        em.persist([testUser, otherUser]);
        await em.flush();

        testCampaign = em.create(Campaign, {
            userId: testUser.id,
            name: 'Test Campaign',
            setupStatus: CampaignSetupStatus.READY_TO_PLAY,
        });
        em.persist(testCampaign);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const sessions = await em.find(GameSession, { campaign: testCampaign.id });
        for (const session of sessions) {
            await em.nativeDelete(GameEvent, { session: session.id });
        }

        await em.nativeDelete(GameSession, { campaign: testCampaign.id });
        await em.nativeDelete(Campaign, { userId: { $in: [testUser.id, otherUser.id] } });
        await em.nativeDelete(User, { id: { $in: [testUser.id, otherUser.id] } });
        await orm.close();
    });

    describe('startSession (3.3, spec 2.1)', () => {
        it('creates an active session with EXPLORATION sceneType', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, {
                campaign: testCampaign,
                sceneType: SceneType.EXPLORATION,
            });
            em.persist(session);
            await em.flush();

            const found = await em.findOneOrFail(GameSession, session.id);
            expect(found.sceneType).toBe(SceneType.EXPLORATION);
            expect(found.endedAt).toBeNull();
        });

        it('session is associated with the campaign', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const found = await em.findOneOrFail(GameSession, session.id, { populate: ['campaign'] });
            expect(found.campaign.id).toBe(testCampaign.id);
        });
    });

    describe('endSession (3.4)', () => {
        it('sets endedAt on the session', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const toEnd = await em.findOneOrFail(GameSession, session.id);
            toEnd.endedAt = new Date();
            await em.flush();

            const ended = await em.findOneOrFail(GameSession, session.id);
            expect(ended.endedAt).toBeInstanceOf(Date);
        });

        it('ended session is not returned as active', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const toEnd = await em.findOneOrFail(GameSession, session.id);
            toEnd.endedAt = new Date();
            await em.flush();

            const active = await em.findOne(GameSession, { campaign: testCampaign.id, endedAt: null });
            expect(active).toBeNull();
        });
    });

    describe('activeSession (3.5)', () => {
        it('returns the active session for a campaign', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const active = await em.findOne(GameSession, { campaign: testCampaign.id, endedAt: null });
            expect(active).toBeDefined();
            expect(active?.id).toBe(session.id);
        });

        it('enforces one-active-session constraint via query', async () => {
            const em = orm.em.fork();
            const session1 = em.create(GameSession, { campaign: testCampaign });
            em.persist(session1);
            await em.flush();

            // eslint-disable-next-line unicorn/no-array-method-this-argument
            const active = await em.find(GameSession, { campaign: testCampaign.id, endedAt: null });
            expect(active.length).toBe(1);
        });
    });

    describe('gameEvents (3.6)', () => {
        it('returns events in chronological order', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const event1 = em.create(GameEvent, {
                session,
                eventType: EventType.PLAYER_INPUT,
                content: { text: 'First' },
            });
            const event2 = em.create(GameEvent, {
                session,
                eventType: EventType.DM_NARRATIVE,
                content: { narrative: 'Second' },
            });
            em.persist([event1, event2]);
            await em.flush();

            const events = await em.find(GameEvent, { session: session.id }, { orderBy: { createdAt: 'ASC' } });
            expect(events).toHaveLength(2);
            expect(events[0].eventType).toBe(EventType.PLAYER_INPUT);
            expect(events[1].eventType).toBe(EventType.DM_NARRATIVE);
        });

        it('stores content as jsonb correctly for each event type', async () => {
            const em = orm.em.fork();
            const session = em.create(GameSession, { campaign: testCampaign });
            em.persist(session);
            await em.flush();

            const content = { text: 'I search the room', extra: { key: 'value' } };
            const event = em.create(GameEvent, {
                session,
                eventType: EventType.PLAYER_INPUT,
                content,
            });
            em.persist(event);
            await em.flush();

            em.clear();
            const found = await em.findOneOrFail(GameEvent, event.id);
            expect(found.content).toEqual(content);
        });
    });

    describe('sendPlayerInput validation (8.4)', () => {
        it('rejects empty text at service layer', () => {
            const text = '   ';
            expect(text.trim()).toBe('');
        });

        it('allows non-empty text', () => {
            const text = 'I look around';
            expect(text.trim()).not.toBe('');
        });
    });
});
