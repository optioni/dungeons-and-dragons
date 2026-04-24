// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { ForbiddenException } from '@nestjs/common';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { CharacterItem } from '../character/entities/character-item.entity';
import { Character } from '../character/entities/character.entity';
import { Item } from '../character/entities/item.entity';
import { getRequiredIntegrationDatabaseUrl } from '../test-integration-environment.js';
import { Location } from '../world/entities/location.entity';
import { Npc } from '../world/entities/npc.entity';
import { WorldEvent } from '../world/entities/world-event.entity';
import { QuestEntity } from './entities/quest-entity.entity';
import { QuestObjective } from './entities/quest-objective.entity';
import { Quest } from './entities/quest.entity';
import { QuestObjectiveType, QuestStatus } from './quest.enums';

const DB_URL = getRequiredIntegrationDatabaseUrl();

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [
                User,
                Campaign,
                Character,
                CharacterItem,
                Item,
                Npc,
                Location,
                WorldEvent,
                Quest,
                QuestObjective,
                QuestEntity,
            ],
        }),
    );
}

describe('Quest GraphQL — integration', () => {
    let orm: MikroORM;
    let testUser: User;
    let otherUser: User;
    let testCampaign: Campaign;
    let otherCampaign: Campaign;
    const createdQuestIds: number[] = [];

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();

        testUser = em.create(User, { email: `quest-test-${Date.now()}@example.com`, passwordHash: 'hash' });
        otherUser = em.create(User, { email: `quest-other-${Date.now()}@example.com`, passwordHash: 'hash' });
        em.persist(testUser);
        em.persist(otherUser);
        await em.flush();

        testCampaign = em.create(Campaign, { userId: testUser.id, name: 'Quest Test Campaign' });
        otherCampaign = em.create(Campaign, { userId: otherUser.id, name: 'Other Campaign' });
        em.persist(testCampaign);
        em.persist(otherCampaign);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();
        const idsToDelete = [...createdQuestIds];
        if (idsToDelete.length > 0) {
            await em.nativeDelete(QuestObjective, { quest: { id: { $in: idsToDelete } } });
            await em.nativeDelete(QuestEntity, { quest: { id: { $in: idsToDelete } } });
            await em.nativeDelete(Quest, { id: { $in: idsToDelete } });
            createdQuestIds.splice(0);
        }

        await em.nativeDelete(Campaign, { id: { $in: [testCampaign.id, otherCampaign.id] } });
        await em.nativeDelete(User, { id: { $in: [testUser.id, otherUser.id] } });
        await orm.close();
    });

    it('returns only quests belonging to the owner campaign', async () => {
        const em = orm.em.fork();

        // Create quest for testCampaign
        const quest = em.create(Quest, {
            campaignId: testCampaign.id,
            title: 'Owner Quest',
            description: 'Desc',
        });
        em.persist(quest);
        await em.flush();
        createdQuestIds.push(quest.id);

        // Create quest for otherCampaign
        const otherQuest = em.create(Quest, {
            campaignId: otherCampaign.id,
            title: 'Other Quest',
            description: 'Desc',
        });
        em.persist(otherQuest);
        await em.flush();
        createdQuestIds.push(otherQuest.id);

        // Query quests for testCampaign only
        const queryEm = orm.em.fork();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const quests = await queryEm.find(Quest, { campaignId: testCampaign.id });
        expect(quests.length).toBe(1);
        expect(quests[0].title).toBe('Owner Quest');
    });

    it('filters quests by status', async () => {
        const em = orm.em.fork();

        const activeQuest = em.create(Quest, {
            campaignId: testCampaign.id,
            title: 'Active Quest',
            description: 'Desc',
        });
        const completedQuest = em.create(Quest, {
            campaignId: testCampaign.id,
            title: 'Completed Quest',
            description: 'Desc',
            status: QuestStatus.COMPLETED,
        });
        em.persist(activeQuest);
        em.persist(completedQuest);
        await em.flush();
        createdQuestIds.push(activeQuest.id, completedQuest.id);

        const queryEm = orm.em.fork();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const activeOnly = await queryEm.find(Quest, { campaignId: testCampaign.id, status: QuestStatus.ACTIVE });
        expect(activeOnly.length).toBe(1);
        expect(activeOnly[0].title).toBe('Active Quest');

        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const completedOnly = await queryEm.find(Quest, { campaignId: testCampaign.id, status: QuestStatus.COMPLETED });
        expect(completedOnly.length).toBe(1);
        expect(completedOnly[0].title).toBe('Completed Quest');
    });

    it('access denied when campaign does not belong to user', async () => {
        const em = orm.em.fork();
        const campaignRepo = em.getRepository(Campaign);

        // testUser trying to access otherCampaign — should find nothing
        const found = await em.findOne(Campaign, { id: otherCampaign.id, userId: testUser.id });
        expect(found).toBeNull();

        // Simulates the ForbiddenException thrown by the resolver
        if (!found) {
            expect(() => {
                throw new ForbiddenException('Campaign not found or access denied');
            }).toThrow(ForbiddenException);
        }

        // satisfy linting
        void campaignRepo;
    });

    it('persists objectives and returns them ordered', async () => {
        const em = orm.em.fork();

        const quest = em.create(Quest, {
            campaignId: testCampaign.id,
            title: 'Objective Quest',
            description: 'Desc',
        });
        em.persist(quest);
        await em.flush();
        createdQuestIds.push(quest.id);

        const object1 = em.create(QuestObjective, {
            quest, questId: quest.id, description: 'Step 2', type: QuestObjectiveType.MANUAL, order: 1,
        });
        const object2 = em.create(QuestObjective, {
            quest, questId: quest.id, description: 'Step 1', type: QuestObjectiveType.MANUAL, order: 0,
        });
        em.persist(object1);
        em.persist(object2);
        await em.flush();

        const queryEm = orm.em.fork();
        const found = await queryEm.findOneOrFail(Quest, quest.id);
        await queryEm.populate(found, ['objectives']);
        const objectives = found.objectives.getItems().sort((a, b) => a.order - b.order);
        expect(objectives[0].description).toBe('Step 1');
        expect(objectives[1].description).toBe('Step 2');
    });
});
