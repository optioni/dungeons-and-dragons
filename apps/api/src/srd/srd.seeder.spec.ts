/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it } from 'vitest';

import {
    type ClassApiResponse,
    type ConditionApiResponse,
    type EquipmentApiResponse,
    mapClass,
    mapCondition,
    mapEquipment,
    mapMonster,
    mapRace,
    mapSpell,
    type MonsterApiResponse,
    type RaceApiResponse,
    type SpellApiResponse,
} from './srd.seeder.js';

describe('mapClass', () => {
    it('maps class response to SrdClass shape', () => {
        const raw: ClassApiResponse = {
            index: 'wizard',
            name: 'Wizard',
            hit_die: 6,
            proficiencies: [{ name: 'Daggers' }, { name: 'Darts' }],
            saving_throws: [{ name: 'INT' }, { name: 'WIS' }],
            spellcasting: { spellcasting_ability: { name: 'INT' } },
        };
        expect(mapClass(raw)).toEqual({
            index: 'wizard',
            name: 'Wizard',
            hitDie: 6,
            proficiencies: ['Daggers', 'Darts'],
            savingThrows: ['INT', 'WIS'],
            spellcastingAbility: 'INT',
        });
    });

    it('sets spellcastingAbility to null when spellcasting is absent', () => {
        const raw: ClassApiResponse = {
            index: 'fighter',
            name: 'Fighter',
            hit_die: 10,
            proficiencies: [{ name: 'All armor' }],
            saving_throws: [{ name: 'STR' }, { name: 'CON' }],
        };
        expect(mapClass(raw).spellcastingAbility).toBeNull();
    });
});

describe('mapRace', () => {
    it('maps race response to SrdRace shape', () => {
        const raw: RaceApiResponse = {
            index: 'elf',
            name: 'Elf',
            speed: 30,
            ability_bonuses: [{ ability_score: { name: 'DEX' }, bonus: 2 }],
            traits: [{ name: 'Darkvision' }, { name: 'Keen Senses' }],
            size: 'Medium',
        };
        expect(mapRace(raw)).toEqual({
            index: 'elf',
            name: 'Elf',
            speed: 30,
            abilityBonuses: [{ ability_score: { name: 'DEX' }, bonus: 2 }],
            traits: ['Darkvision', 'Keen Senses'],
            size: 'Medium',
        });
    });
});

describe('mapSpell', () => {
    it('maps spell response to SrdSpell shape', () => {
        const raw: SpellApiResponse = {
            index: 'fireball',
            name: 'Fireball',
            level: 3,
            school: { name: 'Evocation' },
            casting_time: '1 action',
            range: '150 feet',
            components: ['V', 'S', 'M'],
            duration: 'Instantaneous',
            desc: ['A bright streak flashes from your pointing finger.', 'It deals fire damage.'],
            higher_level: ['When cast at 4th level, add 1d6 for each level above 3rd.'],
            classes: [{ name: 'Sorcerer' }, { name: 'Wizard' }],
        };
        expect(mapSpell(raw)).toEqual({
            index: 'fireball',
            name: 'Fireball',
            level: 3,
            school: 'Evocation',
            castingTime: '1 action',
            range: '150 feet',
            components: ['V', 'S', 'M'],
            duration: 'Instantaneous',
            description: 'A bright streak flashes from your pointing finger.\nIt deals fire damage.',
            higherLevel: 'When cast at 4th level, add 1d6 for each level above 3rd.',
            classes: ['Sorcerer', 'Wizard'],
        });
    });

    it('sets higherLevel to null when absent', () => {
        const raw: SpellApiResponse = {
            index: 'light',
            name: 'Light',
            level: 0,
            school: { name: 'Evocation' },
            casting_time: '1 action',
            range: 'Touch',
            components: ['V', 'M'],
            duration: '1 hour',
            desc: ['You touch one object.'],
            classes: [{ name: 'Cleric' }],
        };
        expect(mapSpell(raw).higherLevel).toBeNull();
    });
});

describe('mapMonster', () => {
    it('maps monster response to SrdMonster shape', () => {
        const raw: MonsterApiResponse = {
            index: 'goblin',
            name: 'Goblin',
            size: 'Small',
            type: 'humanoid',
            alignment: 'neutral evil',
            armor_class: [{ value: 15 }],
            hit_points: 7,
            challenge_rating: 0.25,
            speed: { walk: '30 ft.' },
            strength: 8,
            dexterity: 14,
            constitution: 10,
            intelligence: 10,
            wisdom: 8,
            charisma: 8,
            actions: [{ name: 'Scimitar', desc: 'Melee weapon attack.' }],
        };
        expect(mapMonster(raw)).toEqual({
            index: 'goblin',
            name: 'Goblin',
            size: 'Small',
            type: 'humanoid',
            alignment: 'neutral evil',
            armorClass: 15,
            hitPoints: 7,
            challengeRating: 0.25,
            speed: { walk: '30 ft.' },
            abilityScores: {
                STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8,
            },
            actions: [{ name: 'Scimitar', desc: 'Melee weapon attack.' }],
        });
    });

    it('defaults armorClass to 0 when armor_class array is empty', () => {
        const raw: MonsterApiResponse = {
            index: 'test',
            name: 'Test',
            size: 'Tiny',
            type: 'beast',
            alignment: 'unaligned',
            armor_class: [],
            hit_points: 1,
            challenge_rating: 0,
            speed: {},
            strength: 1,
            dexterity: 1,
            constitution: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1,
        };
        expect(mapMonster(raw).armorClass).toBe(0);
    });

    it('defaults actions to empty array when absent', () => {
        const raw: MonsterApiResponse = {
            index: 'ooze',
            name: 'Ooze',
            size: 'Medium',
            type: 'ooze',
            alignment: 'unaligned',
            armor_class: [{ value: 8 }],
            hit_points: 22,
            challenge_rating: 0.5,
            speed: { walk: '10 ft.' },
            strength: 14,
            dexterity: 6,
            constitution: 15,
            intelligence: 1,
            wisdom: 6,
            charisma: 1,
        };
        expect(mapMonster(raw).actions).toEqual([]);
    });
});

describe('mapEquipment', () => {
    it('maps equipment response to SrdEquipment shape', () => {
        const raw: EquipmentApiResponse = {
            index: 'longsword',
            name: 'Longsword',
            equipment_category: { name: 'Weapon' },
            cost: { quantity: 15, unit: 'gp' },
            weight: 3,
            properties: [{ name: 'Versatile' }],
            damage: { damage_dice: '1d8', damage_type: { name: 'Slashing' } },
        };
        expect(mapEquipment(raw)).toEqual({
            index: 'longsword',
            name: 'Longsword',
            category: 'Weapon',
            cost: { quantity: 15, unit: 'gp' },
            weight: 3,
            properties: ['Versatile'],
            damage: { damage_dice: '1d8', damage_type: { name: 'Slashing' } },
        });
    });

    it('sets weight to null and properties to [] when absent', () => {
        const raw: EquipmentApiResponse = {
            index: 'backpack',
            name: 'Backpack',
            equipment_category: { name: 'Adventuring Gear' },
            cost: { quantity: 2, unit: 'gp' },
        };
        const result = mapEquipment(raw);
        expect(result.weight).toBeNull();
        expect(result.properties).toEqual([]);
        expect(result.damage).toBeNull();
    });
});

describe('mapCondition', () => {
    it('maps condition response to SrdCondition shape', () => {
        const raw: ConditionApiResponse = {
            index: 'blinded',
            name: 'Blinded',
            desc: [
                'A blinded creature can\'t see and automatically fails any ability check that requires sight.',
                'Attack rolls against the creature have advantage.',
            ],
        };
        expect(mapCondition(raw)).toEqual({
            index: 'blinded',
            name: 'Blinded',
            description:
                'A blinded creature can\'t see and automatically fails any ability check that requires sight.\nAttack rolls against the creature have advantage.',
        });
    });
});
/* eslint-enable @typescript-eslint/naming-convention */
