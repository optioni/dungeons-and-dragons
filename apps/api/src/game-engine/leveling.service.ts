import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { type AbilityScores, type SpellSlot } from '../character/character.enums.js';
import { Character } from '../character/entities/character.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';

export interface LevelingResult { success: true; data: Record<string, unknown> }
export interface LevelingError { success: false; errorCode: string; message: string }
type LevelingOutcome = LevelingResult | LevelingError;

/**
 * Handles trigger_level_up, apply_level_up, use_spell_slot, and prepare_spells tool logic.
 */
@Injectable()
export class LevelingService {
    constructor(private readonly em: EntityManager) {}

    /** Sets levelUpPending = true and returns a structured level-up payload. */
    async triggerLevelUp(sessionId: number, characterId: number): Promise<LevelingOutcome> {
        const session = await this.em.findOne(GameSession, { id: sessionId });
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        if (session.levelUpPending) {
            return { success: false, errorCode: 'LEVEL_UP_ALREADY_PENDING', message: 'A level-up is already pending' };
        }

        const char = await this.em.findOne(Character, { id: characterId }, { populate: ['srdClass'] as never });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        session.levelUpPending = true;
        await this.em.flush();

        const newLevel = char.level + 1;
        const hitDie = (char as unknown as { srdClass?: { hitDie?: number } }).srdClass?.hitDie ?? 8;

        return {
            success: true,
            data: {
                newLevel,
                hitDie,
                options: {
                    asiOrFeat: newLevel % 4 === 0,
                    spellSlots: char.spellSlots,
                },
            },
        };
    }

    /** Validates and applies level-up choices. Increments Character.level, updates stats. */
    async applyLevelUp(
        sessionId: number,
        characterId: number,
        choices: {
            abilityScoreImprovements?: Partial<Record<keyof AbilityScores, number>>;
            feat?: string;
        },
        hitPointsRolled: number,
    ): Promise<LevelingOutcome> {
        const session = await this.em.findOne(GameSession, { id: sessionId });
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        // Validate ASI choices
        if (choices.abilityScoreImprovements) {
            const total = Object.values(choices.abilityScoreImprovements).reduce((a, b) => a + b, 0);
            if (total > 2) {
                return { success: false, errorCode: 'INVALID_ASI_CHOICES', message: 'ASI increments must total ≤ 2' };
            }
            for (const [ability, increment] of Object.entries(choices.abilityScoreImprovements)) {
                (char.abilityScores as Record<string, number>)[ability] += increment;
            }
        }

        // Calculate HP increase: hitPointsRolled + CON modifier
        const conMod = Math.floor(((char.abilityScores as Record<string, number>).CON - 10) / 2);
        char.maxHp += hitPointsRolled + conMod;
        char.level += 1;

        session.levelUpPending = false;
        await this.em.flush();

        return { success: true, data: { level: char.level, maxHp: char.maxHp } };
    }

    /** Decrements an available spell slot. */
    async useSpellSlot(characterId: number, level: number): Promise<LevelingOutcome> {
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        const slot = (char.spellSlots as SpellSlot[]).find((s) => s.level === level);
        if (!slot || slot.used >= slot.total) {
            return { success: false, errorCode: 'NO_SPELL_SLOT_AVAILABLE', message: `No available level ${level} spell slots` };
        }

        slot.used += 1;
        char.spellSlots = [...char.spellSlots as SpellSlot[]];
        await this.em.flush();

        return { success: true, data: { level, used: slot.used, total: slot.total } };
    }

    /** Replaces the character's prepared spells list. */
    async prepareSpells(characterId: number, spellIds: string[]): Promise<LevelingOutcome> {
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        char.preparedSpells = spellIds;
        await this.em.flush();

        return { success: true, data: { preparedSpells: spellIds } };
    }
}
