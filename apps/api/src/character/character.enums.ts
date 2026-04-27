import { registerEnumType } from '@nestjs/graphql';

export enum EquipSlot {
    MAIN_HAND = 'MAIN_HAND',
    OFF_HAND = 'OFF_HAND',
    HEAD = 'HEAD',
    CHEST = 'CHEST',
    HANDS = 'HANDS',
    FEET = 'FEET',
    RING_1 = 'RING_1',
    RING_2 = 'RING_2',
    NECK = 'NECK',
    BACK = 'BACK',
}

registerEnumType(EquipSlot, { name: 'EquipSlot' });

export enum ItemType {
    WEAPON = 'WEAPON',
    ARMOR = 'ARMOR',
    SHIELD = 'SHIELD',
    POTION = 'POTION',
    SCROLL = 'SCROLL',
    WONDROUS = 'WONDROUS',
    TOOL = 'TOOL',
    GEAR = 'GEAR',
    CURRENCY = 'CURRENCY',
    OTHER = 'OTHER',
    MISC = 'MISC',
}

registerEnumType(ItemType, { name: 'ItemType' });

export const SKILL_NAMES = [
    'Acrobatics',
    'Animal Handling',
    'Arcana',
    'Athletics',
    'Deception',
    'History',
    'Insight',
    'Intimidation',
    'Investigation',
    'Medicine',
    'Nature',
    'Perception',
    'Performance',
    'Persuasion',
    'Religion',
    'Sleight of Hand',
    'Stealth',
    'Survival',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];
export type SkillProficiency = 'none' | 'proficient' | 'expert';
export type SkillProficiencies = Record<SkillName, SkillProficiency>;

/* eslint-disable @typescript-eslint/naming-convention */
export interface AbilityScores {
    STR: number
    DEX: number
    CON: number
    INT: number
    WIS: number
    CHA: number
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface SpellSlot {
    level: number
    total: number
    used: number
}
