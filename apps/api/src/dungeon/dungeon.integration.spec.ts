// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { ItemType } from '../character/character.enums';
import { Item } from '../character/entities/item.entity';
import { DiaryEntry } from '../memory/entities/diary-entry.entity';
import { Memory } from '../memory/entities/memory.entity';
import { QuestEntity } from '../quest/entities/quest-entity.entity';
import { QuestObjective } from '../quest/entities/quest-objective.entity';
import { Quest } from '../quest/entities/quest.entity';
import { QuestEntityType } from '../quest/quest.enums';
import { GameEvent } from '../session/entities/game-event.entity';
import { GameSession } from '../session/entities/game-session.entity';
import { SceneType } from '../session/session.enums';
import { Location } from '../world/entities/location.entity';
import { Npc } from '../world/entities/npc.entity';
import { RoomState } from './dungeon.enums';
import { Dungeon } from './entities/dungeon.entity';
import { RoomEncounter } from './entities/room-encounter.entity';
import { RoomItem } from './entities/room-item.entity';

const DB_URL = 'postgresql://dnd:dnd@localhost:5432/dnd';

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [
                User,
                Campaign,
                DiaryEntry,
                Memory,
                Item,
                Dungeon,
                RoomEncounter,
                RoomItem,
                Location,
                GameSession,
                GameEvent,
                Npc,
                Quest,
                QuestObjective,
                QuestEntity,
            ],
        }),
    );
}

describe('Dungeon system — integration', () => {
    let orm: MikroORM;
    let testUser: User;
    let testCampaign: Campaign;
    const createdDungeonIds: number[] = [];
    const createdSessionIds: number[] = [];
    const createdQuestIds: number[] = [];

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();

        testUser = em.create(User, { email: `dungeon-test-${Date.now()}@example.com`, passwordHash: 'hash' });
        em.persist(testUser);
        await em.flush();

        testCampaign = em.create(Campaign, { userId: testUser.id, name: 'Dungeon Test Campaign' });
        em.persist(testCampaign);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();

        if (createdQuestIds.length > 0) {
            await em.nativeDelete(QuestObjective, { quest: { id: { $in: createdQuestIds } } });
            await em.nativeDelete(QuestEntity, { quest: { id: { $in: createdQuestIds } } });
            await em.nativeDelete(Quest, { id: { $in: createdQuestIds } });
            createdQuestIds.splice(0);
        }

        if (createdSessionIds.length > 0) {
            await em.nativeDelete(GameEvent, { session: { id: { $in: createdSessionIds } } });
            await em.nativeDelete(GameSession, { id: { $in: createdSessionIds } });
            createdSessionIds.splice(0);
        }

        await em.nativeDelete(Npc, { campaignId: testCampaign.id });

        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const rooms = await em.find(Location, { campaignId: testCampaign.id });
        for (const room of rooms) {
            await em.nativeDelete(RoomItem, { room: room.id });
            await em.nativeDelete(RoomEncounter, { room: room.id });
        }

        await em.nativeDelete(Location, { campaignId: testCampaign.id });

        if (createdDungeonIds.length > 0) {
            await em.nativeDelete(Dungeon, { id: { $in: createdDungeonIds } });
            createdDungeonIds.splice(0);
        }

        await em.nativeDelete(Campaign, { id: testCampaign.id });
        await em.nativeDelete(User, { id: testUser.id });
        await orm.close();
    });

    describe('full dungeon flow (10.5)', () => {
        it('completes enter → move → spawn → update state → loot → exit in sequence', async () => {
            const em = orm.em.fork();

            const dungeon = em.create(Dungeon, {
                campaign: testCampaign,
                name: 'Goblin Cave',
                description: 'A dank cave full of goblins',
                totalFloors: 1,
            });
            em.persist(dungeon);
            await em.flush();
            createdDungeonIds.push(dungeon.id);

            const room = em.create(Location, {
                campaignId: testCampaign.id,
                dungeon,
                name: 'Entrance Chamber',
                description: 'The cave entrance',
                floor: 1,
                roomState: RoomState.UNEXPLORED,
            });
            em.persist(room);

            const item = em.create(Item, {
                name: 'Healing Potion',
                description: 'Restores HP',
                itemType: ItemType.POTION,
            });
            em.persist(item);
            await em.flush();

            const encounter = em.create(RoomEncounter, {
                room,
                description: '2 goblins lurk here',
                monsters: [{ name: 'Goblin', count: 2, hp: 7 }],
            });
            em.persist(encounter);

            const roomItem = em.create(RoomItem, { room, item, quantity: 1 });
            em.persist(roomItem);

            const session = em.create(GameSession, {
                campaign: testCampaign,
                sceneType: SceneType.EXPLORATION,
            });
            em.persist(session);
            await em.flush();
            createdSessionIds.push(session.id);

            // ENTER: set activeDungeon, sceneType = DUNGEON
            session.activeDungeon = dungeon;
            session.sceneType = SceneType.DUNGEON;
            await em.flush();

            const afterEnter = await orm.em.fork().findOneOrFail(
                GameSession,
                session.id,
                { populate: ['activeDungeon'] },
            );
            expect(afterEnter.activeDungeon?.id).toBe(dungeon.id);
            expect(afterEnter.sceneType).toBe(SceneType.DUNGEON);

            // MOVE: transition room UNEXPLORED → EXPLORED, update campaign currentLocationId
            const em2 = orm.em.fork();
            const campaign2 = await em2.findOneOrFail(Campaign, testCampaign.id);
            const room2 = await em2.findOneOrFail(Location, room.id);
            campaign2.currentLocationId = room2.id;
            room2.roomState = RoomState.EXPLORED;
            await em2.flush();

            const afterMove = await orm.em.fork().findOneOrFail(Location, room.id);
            expect(afterMove.roomState).toBe(RoomState.EXPLORED);

            // SPAWN: create NPCs for the encounter
            const em3 = orm.em.fork();
            const npc1 = em3.create(Npc, {
                campaignId: testCampaign.id,
                name: 'Goblin 1',
                hp: 7,
                maxHp: 7,
                currentLocationId: room.id,
            });
            const npc2 = em3.create(Npc, {
                campaignId: testCampaign.id,
                name: 'Goblin 2',
                hp: 7,
                maxHp: 7,
                currentLocationId: room.id,
            });
            em3.persist([npc1, npc2]);
            await em3.flush();

            // eslint-disable-next-line unicorn/no-array-method-this-argument
            const spawnedNpcs = await orm.em.fork().find(Npc, { campaignId: testCampaign.id });
            expect(spawnedNpcs.length).toBe(2);
            expect(spawnedNpcs.map((n) => n.currentLocationId)).toEqual([room.id, room.id]);

            // UPDATE ROOM STATE: EXPLORED → CLEARED
            const em4 = orm.em.fork();
            const room4 = await em4.findOneOrFail(Location, room.id);
            room4.roomState = RoomState.CLEARED;
            await em4.flush();

            const afterStateUpdate = await orm.em.fork().findOneOrFail(Location, room.id);
            expect(afterStateUpdate.roomState).toBe(RoomState.CLEARED);

            // LOOT: remove RoomItem (item transferred to character inventory in real flow)
            const em5 = orm.em.fork();
            const roomItem5 = await em5.findOneOrFail(RoomItem, { room: room.id, item: item.id });
            em5.remove(roomItem5);
            await em5.flush();

            const afterLoot = await orm.em.fork().findOne(RoomItem, { room: room.id, item: item.id });
            expect(afterLoot).toBeNull();

            // EXIT: clear activeDungeon, set sceneType = EXPLORATION
            const em6 = orm.em.fork();
            const session6 = await em6.findOneOrFail(GameSession, session.id, { populate: ['activeDungeon'] });
            session6.activeDungeon = null;
            session6.sceneType = SceneType.EXPLORATION;
            await em6.flush();

            const afterExit = await orm.em.fork().findOneOrFail(GameSession, session.id, { populate: ['activeDungeon'] });
            expect(afterExit.activeDungeon).toBeNull();
            expect(afterExit.sceneType).toBe(SceneType.EXPLORATION);
        });
    });

    describe('activeDungeonId persists through scene changes (10.6)', () => {
        it('activeDungeonId is preserved when sceneType transitions DUNGEON → COMBAT → DUNGEON', async () => {
            const em = orm.em.fork();

            const dungeon = em.create(Dungeon, {
                campaign: testCampaign,
                name: 'Persistent Dungeon',
                description: 'Tests scene change persistence',
            });
            em.persist(dungeon);

            const session = em.create(GameSession, {
                campaign: testCampaign,
                sceneType: SceneType.EXPLORATION,
            });
            em.persist(session);
            await em.flush();
            createdDungeonIds.push(dungeon.id);
            createdSessionIds.push(session.id);

            // Enter dungeon
            session.activeDungeon = dungeon;
            session.sceneType = SceneType.DUNGEON;
            await em.flush();

            const inDungeon = await orm.em.fork().findOneOrFail(
                GameSession,
                session.id,
                { populate: ['activeDungeon'] },
            );
            expect(inDungeon.activeDungeon?.id).toBe(dungeon.id);
            expect(inDungeon.sceneType).toBe(SceneType.DUNGEON);

            // Combat starts — only sceneType changes, activeDungeon must NOT be cleared
            const em2 = orm.em.fork();
            const s2 = await em2.findOneOrFail(GameSession, session.id, { populate: ['activeDungeon'] });
            s2.sceneType = SceneType.COMBAT;
            await em2.flush();

            const inCombat = await orm.em.fork().findOneOrFail(
                GameSession,
                session.id,
                { populate: ['activeDungeon'] },
            );
            expect(inCombat.activeDungeon?.id).toBe(dungeon.id);
            expect(inCombat.sceneType).toBe(SceneType.COMBAT);

            // Combat ends — scene returns to DUNGEON, activeDungeon still set
            const em3 = orm.em.fork();
            const s3 = await em3.findOneOrFail(GameSession, session.id, { populate: ['activeDungeon'] });
            s3.sceneType = SceneType.DUNGEON;
            await em3.flush();

            const backInDungeon = await orm.em.fork().findOneOrFail(
                GameSession,
                session.id,
                { populate: ['activeDungeon'] },
            );
            expect(backInDungeon.activeDungeon?.id).toBe(dungeon.id);
            expect(backInDungeon.sceneType).toBe(SceneType.DUNGEON);
        });
    });

    describe('quest with dungeon entity (10.7)', () => {
        it('creates QuestEntity with type=DUNGEON when quest is linked to a dungeon', async () => {
            const em = orm.em.fork();

            const dungeon = em.create(Dungeon, {
                campaign: testCampaign,
                name: 'Quest Dungeon',
                description: 'Dungeon linked to a quest',
            });
            em.persist(dungeon);
            await em.flush();
            createdDungeonIds.push(dungeon.id);

            const quest = em.create(Quest, {
                campaignId: testCampaign.id,
                title: 'Clear the Dungeon',
                description: 'Defeat all enemies within',
            });
            em.persist(quest);
            await em.flush();
            createdQuestIds.push(quest.id);

            const questEntity = em.create(QuestEntity, {
                quest,
                entityType: QuestEntityType.DUNGEON,
                entityId: dungeon.id,
            });
            em.persist(questEntity);
            await em.flush();

            const found = await orm.em.fork().findOneOrFail(
                QuestEntity,
                { quest: quest.id, entityType: QuestEntityType.DUNGEON },
            );
            expect(found.entityType).toBe(QuestEntityType.DUNGEON);
            expect(found.entityId).toBe(dungeon.id);

            // Verify reverse lookup: all DUNGEON entities for this dungeon

            const byDungeon = await orm.em.fork().find(
                QuestEntity,
                { entityType: QuestEntityType.DUNGEON, entityId: dungeon.id },
            );
            expect(byDungeon).toHaveLength(1);
            expect(byDungeon[0].quest.id).toBe(quest.id);
        });
    });
});
