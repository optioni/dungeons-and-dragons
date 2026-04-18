// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { User } from '../auth/entities/user.entity';
import { SrdClass } from '../srd/entities/srd-class.entity';
import { SrdEquipment } from '../srd/entities/srd-equipment.entity';
import { SrdRace } from '../srd/entities/srd-race.entity';
import { type AbilityScores, EquipSlot } from './character.enums';
import { CharacterService } from './character.service';
import { Campaign } from './entities/campaign.entity';
import { CharacterItem } from './entities/character-item.entity';
import { Character } from './entities/character.entity';
import { Item } from './entities/item.entity';

const DB_URL = 'postgresql://dnd:dnd@localhost:5432/dnd';
/* eslint-disable @typescript-eslint/naming-convention */
const STANDARD_ARRAY: AbilityScores = {
    STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8,
};
/* eslint-enable @typescript-eslint/naming-convention */

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [User, SrdRace, SrdClass, SrdEquipment, Campaign, Character, Item, CharacterItem],
        }),
    );
}

describe('CharacterService integration', () => {
    let orm: MikroORM;
    let service: CharacterService;
    let testUser: User;
    let testCampaign: Campaign;
    let testRace: SrdRace;
    let testClass: SrdClass;
    const createdCharacterIds: number[] = [];

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();

        const charRepo = em.getRepository(Character);
        const charItemRepo = em.getRepository(CharacterItem);
        const itemRepo = em.getRepository(Item);
        service = new CharacterService(charRepo as never, charItemRepo as never, itemRepo as never);

        // Fetch a seeded race and class
        testRace = await em.findOneOrFail(SrdRace, { index: 'human' });
        testClass = await em.findOneOrFail(SrdClass, { index: 'fighter' });

        // Create a test user and campaign
        testUser = em.create(User, { email: `test-${Date.now()}@example.com`, passwordHash: 'hashed' });
        em.persist(testUser);
        await em.flush();

        testCampaign = em.create(Campaign, { userId: testUser.id, name: 'Test Campaign' });
        em.persist(testCampaign);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();
        const idsToDelete = [...createdCharacterIds];
        createdCharacterIds.length = 0;

        if (idsToDelete.length > 0) {
            await em.nativeDelete(CharacterItem, { character: { id: { $in: idsToDelete } } });
            await em.nativeDelete(Character, { id: { $in: idsToDelete } });
        }

        await em.nativeDelete(Campaign, { id: testCampaign.id });
        await em.nativeDelete(User, { id: testUser.id });
        await orm.close();
    });

    // Task 7.1 — valid standard array → character persisted with correct initial state
    describe('createCharacter', () => {
        it('persists a character with correct initial state from a valid standard array', async () => {
            const character = await service.create(
                {
                    name: 'Aldric',
                    raceId: testRace.id,
                    classId: testClass.id,
                    campaignId: testCampaign.id,
                    abilityScores: STANDARD_ARRAY,
                },
                testUser,
            );
            createdCharacterIds.push(character.id);

            expect(character.name).toBe('Aldric');
            expect(character.level).toBe(1);
            expect(character.xp).toBe(0);
            expect(character.isDead).toBe(false);
            expect(character.deathSaveSuccesses).toBe(0);
            expect(character.deathSaveFailures).toBe(0);
            expect(character.goldPieces).toBe(0);

            // Fighter hitDie=10, CON=13 → modifier +1 → maxHp=11
            expect(character.maxHp).toBe(11);
            expect(character.hp).toBe(11);

            // DEX=14 → modifier +2 → ac=12
            expect(character.ac).toBe(12);

            // Fighter is non-caster → empty spell slots
            expect(character.spellSlots).toEqual([]);
            expect(character.preparedSpells).toEqual([]);

            // All 18 skills start at 'none'
            expect(Object.values(character.skillProficiencies).every((value) => value === 'none')).toBe(true);
            expect(Object.keys(character.skillProficiencies)).toHaveLength(18);

            // Verify persistence
            const em = orm.em.fork();
            const persisted = await em.findOneOrFail(Character, { id: character.id });
            expect(persisted.name).toBe('Aldric');
        });

        // Task 7.2 — invalid ability scores → validation error, no row created
        it('rejects invalid ability scores and does not persist a character', async () => {
            const em = orm.em.fork();
            const countBefore = await em.count(Character, {});

            await expect(
                service.create(
                    {
                        name: 'Cheater',
                        raceId: testRace.id,
                        classId: testClass.id,
                        campaignId: testCampaign.id,
                        /* eslint-disable @typescript-eslint/naming-convention */
                        abilityScores: {
                            STR: 18, DEX: 18, CON: 18, INT: 18, WIS: 18, CHA: 18,
                        },
                        /* eslint-enable @typescript-eslint/naming-convention */
                    },
                    testUser,
                ),
            ).rejects.toThrow('must be a permutation of the standard array');

            const countAfter = await em.count(Character, {});
            expect(countAfter).toBe(countBefore);
        });
    });

    // Tasks 7.3–7.4 — equipItem / unequipItem
    describe('equipItem / unequipItem', () => {
        let character: Character;
        let item: Item;
        let characterItem: CharacterItem;

        beforeEach(async () => {
            character = await service.create(
                {
                    name: 'Warrior',
                    raceId: testRace.id,
                    classId: testClass.id,
                    campaignId: testCampaign.id,
                    abilityScores: STANDARD_ARRAY,
                },
                testUser,
            );
            createdCharacterIds.push(character.id);

            const em = orm.em.fork();
            item = em.create(Item, {
                name: 'Longsword',
                description: 'A fine blade',
                itemType: 'WEAPON',
            } as never);
            em.persist(item);

            characterItem = em.create(CharacterItem, { character, item } as never);
            em.persist(characterItem);
            await em.flush();
        });

        // Task 7.3 — equip → slot assigned; second equip to same slot → error
        it('assigns a slot to a CharacterItem', async () => {
            const result = await service.equipItem(characterItem.id, EquipSlot.MAIN_HAND, testUser.id);
            expect(result.slot).toBe(EquipSlot.MAIN_HAND);

            const em = orm.em.fork();
            const persisted = await em.findOneOrFail(CharacterItem, { id: characterItem.id });
            expect(persisted.slot).toBe(EquipSlot.MAIN_HAND);
        });

        it('throws ConflictException when equipping to an already-occupied slot', async () => {
            // Equip first item
            await service.equipItem(characterItem.id, EquipSlot.MAIN_HAND, testUser.id);

            // Create a second item in the same character's inventory
            const em = orm.em.fork();
            const item2 = em.create(Item, { name: 'Dagger', description: 'Sharp', itemType: 'WEAPON' } as never);
            em.persist(item2);
            const ci2 = em.create(CharacterItem, { character, item: item2 } as never);
            em.persist(ci2);
            await em.flush();

            await expect(service.equipItem(ci2.id, EquipSlot.MAIN_HAND, testUser.id)).rejects.toThrow('MAIN_HAND');

            await em.nativeDelete(CharacterItem, { id: ci2.id });
            await em.nativeDelete(Item, { id: item2.id });
        });

        // Task 7.4 — unequip → slot cleared, item remains in inventory
        it('clears the slot when unequipping, item remains in inventory', async () => {
            // First equip
            await service.equipItem(characterItem.id, EquipSlot.MAIN_HAND, testUser.id);

            // Then unequip
            const unequipped = await service.unequipItem(characterItem.id, testUser.id);
            expect(unequipped.slot).toBeNull();

            const em = orm.em.fork();
            const persisted = await em.findOneOrFail(CharacterItem, { id: characterItem.id });
            expect(persisted.slot).toBeNull();

            // Item still exists in inventory
            const inv = await service.getInventory(character.id, testUser.id);
            expect(inv.some((ci) => ci.id === characterItem.id)).toBe(true);
        });
    });

    // Task 7.5 — non-owner access → forbidden errors
    describe('ownership verification', () => {
        it('throws NotFoundException for character query by non-owner', async () => {
            const em = orm.em.fork();
            const otherUser = em.create(User, {
                email: `other-${Date.now()}@example.com`,
                passwordHash: 'hashed',
            });
            em.persist(otherUser);
            await em.flush();

            const character = await service.create(
                {
                    name: 'Protected',
                    raceId: testRace.id,
                    classId: testClass.id,
                    campaignId: testCampaign.id,
                    abilityScores: STANDARD_ARRAY,
                },
                testUser,
            );
            createdCharacterIds.push(character.id);

            await expect(service.findById(character.id, otherUser.id)).rejects.toThrow('not found');

            await em.nativeDelete(User, { id: otherUser.id });
        });

        it('throws NotFoundException for equipItem called by non-owner', async () => {
            const character = await service.create(
                {
                    name: 'Protected2',
                    raceId: testRace.id,
                    classId: testClass.id,
                    campaignId: testCampaign.id,
                    abilityScores: STANDARD_ARRAY,
                },
                testUser,
            );
            createdCharacterIds.push(character.id);

            const em = orm.em.fork();
            const item = em.create(Item, { name: 'Shield', description: '-', itemType: 'SHIELD' } as never);
            em.persist(item);
            const ci = em.create(CharacterItem, { character, item } as never);
            em.persist(ci);
            await em.flush();

            // Non-owner ID
            await expect(service.equipItem(ci.id, EquipSlot.CHEST, 99_999)).rejects.toThrow('not found');

            await em.nativeDelete(CharacterItem, { id: ci.id });
            await em.nativeDelete(Item, { id: item.id });
        });
    });
});
