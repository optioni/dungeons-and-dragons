import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { type SkillName, SKILL_NAMES } from '../character/character.enums.js';
import { Character } from '../character/entities/character.entity.js';
import { type RollOutcome, DiceService } from './dice.service.js';

export type AbilityName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/** Skill name → governing ability map. */
const SKILL_ABILITY: Record<SkillName, AbilityName> = {
    Acrobatics: 'DEX',
    'Animal Handling': 'WIS',
    Arcana: 'INT',
    Athletics: 'STR',
    Deception: 'CHA',
    History: 'INT',
    Insight: 'WIS',
    Intimidation: 'CHA',
    Investigation: 'INT',
    Medicine: 'WIS',
    Nature: 'INT',
    Perception: 'WIS',
    Performance: 'CHA',
    Persuasion: 'CHA',
    Religion: 'INT',
    'Sleight of Hand': 'DEX',
    Stealth: 'DEX',
    Survival: 'WIS',
};

function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
}

export interface CheckResult {
    success: true;
    data: {
        roll: number;
        modifier: number;
        total: number;
        dc: number;
        passed: boolean;
    };
}

export interface CheckError {
    success: false;
    errorCode: string;
    message: string;
}

/**
 * Handles roll_dice, check_skill, and check_ability tool logic.
 */
@Injectable()
export class DiceChecksService {
    constructor(
        private readonly em: EntityManager,
        private readonly dice: DiceService = new DiceService(),
    ) {}

    /**
     * Rolls a dice expression and returns the result.
     * Returns a structured error for invalid expressions.
     */
    rollDice(expression: string): RollOutcome {
        return this.dice.roll(expression);
    }

    /**
     * Performs a skill check for a character against a DC.
     * Applies proficiency/expertise bonuses based on the character's skill proficiencies.
     */
    async checkSkill(
        characterId: number,
        skill: string,
        dc: number,
    ): Promise<CheckResult | CheckError> {
        const character = await this.em.findOne(Character, { id: characterId });
        if (!character) {
            return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };
        }

        if (!SKILL_NAMES.includes(skill as SkillName)) {
            return { success: false, errorCode: 'INVALID_SKILL', message: `Unknown skill: ${skill}` };
        }

        const skillName = skill as SkillName;
        const ability = SKILL_ABILITY[skillName];
        const abilityScore = (character.abilityScores as Record<string, number>)[ability] ?? 10;
        const abilityMod = abilityModifier(abilityScore);
        const proficiency = character.skillProficiencies[skillName];
        const profBonus = character.proficiencyBonus;

        let profMultiplier = 0;
        if (proficiency === 'proficient') profMultiplier = 1;
        else if (proficiency === 'expert') profMultiplier = 2;

        const modifier = abilityMod + profBonus * profMultiplier;
        const roll = this.dice.d20();
        const total = roll + modifier;

        return {
            success: true,
            data: {
                roll,
                modifier,
                total,
                dc,
                passed: total >= dc,
            },
        };
    }

    /**
     * Performs a raw ability check (no proficiency) for a character against a DC.
     */
    async checkAbility(
        characterId: number,
        ability: AbilityName,
        dc: number,
    ): Promise<CheckResult | CheckError> {
        const character = await this.em.findOne(Character, { id: characterId });
        if (!character) {
            return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };
        }

        const abilityScore = (character.abilityScores as Record<string, number>)[ability] ?? 10;
        const modifier = abilityModifier(abilityScore);
        const roll = this.dice.d20();
        const total = roll + modifier;

        return {
            success: true,
            data: {
                roll,
                modifier,
                total,
                dc,
                passed: total >= dc,
            },
        };
    }
}
