import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type SpellSlot } from '../character/character.enums.js';
import { Character } from '../character/entities/character.entity.js';
import { DiceService } from './dice.service.js';

export interface RestResult {
    success: true
    data: Record<string, unknown>
}

export interface RestError {
    success: false
    errorCode: string
    message: string
}

type RestOutcome = RestResult | RestError;

/**
 * Handles short rest and long rest tool logic.
 */
@Injectable()
export class RestService {
    constructor(
        private readonly em: EntityManager,
        private readonly dice: DiceService,
    ) {}

    /** Spends hit dice to restore HP. Does not advance inGameDate. */
    async takeShortRest(characterId: number, hitDiceToSpend: number): Promise<RestOutcome> {
        const char = await this.em.findOne(Character, { id: characterId }, { populate: ['srdClass'] as never });
        if (!char) {
            return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };
        }

        const toSpend = Math.min(hitDiceToSpend, char.hitDiceRemaining);
        let hpRestored = 0;

        const hitDie = (char as unknown as { srdClass?: { hitDie?: number } }).srdClass?.hitDie ?? 8;
        const conModule = Math.floor(((char.abilityScores as unknown as Record<string, number>).CON - 10) / 2);

        for (let index = 0; index < toSpend; index++) {
            const roll = this.dice.roll(`1d${hitDie}`);
            if (roll.success) {
                hpRestored += Math.max(1, roll.total + conModule);
            }
        }

        char.hitDiceRemaining -= toSpend;
        char.hp = Math.min(char.maxHp, char.hp + hpRestored);
        await this.em.flush();

        return { success: true, data: { hitDiceSpent: toSpend, hpRestored, newHp: char.hp } };
    }

    /**
     * Performs a long rest: restores HP, spell slots, hit dice, resets death saves,
     * advances inGameDate. Triggers diary write and world tick asynchronously.
     */
    async takeLongRest(characterId: number, campaignId: number): Promise<RestOutcome> {
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) {
            return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };
        }

        const campaign = await this.em.findOne(Campaign, { id: campaignId });

        // Restore HP
        char.hp = char.maxHp;

        // Restore all spell slots
        char.spellSlots = (char.spellSlots as SpellSlot[]).map((slot) => ({ ...slot, used: 0 }));

        // Restore hit dice (up to half level, rounded up, capped at level)
        const restoreCount = Math.ceil(char.level / 2);
        char.hitDiceRemaining = Math.min(char.level, char.hitDiceRemaining + restoreCount);

        // Reset death saves
        char.deathSaveSuccesses = 0;
        char.deathSaveFailures = 0;

        // Advance inGameDate and inGameDay
        if (campaign) {
            const current = campaign.inGameDate ?? 'Day 1';
            // Simple increment: append " (next day)" or parse if it's "Day N"
            // eslint-disable-next-line require-unicode-regexp
            const dayMatch = /Day (\d+)/.exec(current);
            if (dayMatch) {
                campaign.inGameDate = `Day ${Number.parseInt(dayMatch[1]!, 10) + 1}`;
            } else {
                campaign.inGameDate = `${current} (next day)`;
            }

            campaign.inGameDay = (campaign.inGameDay ?? 1) + 1;
        }

        await this.em.flush();

        return {
            success: true,
            data: { hp: char.hp, spellSlots: char.spellSlots, hitDiceRemaining: char.hitDiceRemaining },
        };
    }
}
