import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Character } from '../character/entities/character.entity.js';
import { CombatSession, type Combatant } from '../session/entities/combat-session.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { STATE_CHANGED_EVENT, StateChangedEvent } from './events/state-changed.event.js';
import { DiceService } from './dice.service.js';

export interface CombatResult {
    success: true;
    data: Record<string, unknown>;
}

export interface CombatError {
    success: false;
    errorCode: string;
    message: string;
}

type CombatOutcome = CombatResult | CombatError;

const COMBAT_ONLY_CONDITIONS = new Set(['PRONE', 'RESTRAINED', 'GRAPPLED']);

/**
 * Implements all combat-related LLM tool logic: initiative, damage, healing,
 * conditions, death saves, and combat lifecycle.
 */
@Injectable()
export class CombatService {
    constructor(
        private readonly em: EntityManager,
        private readonly dice: DiceService,
        private readonly events: EventEmitter2,
    ) {}

    private async loadSession(sessionId: number): Promise<GameSession | null> {
        return this.em.findOne(GameSession, { id: sessionId }, { populate: ['combatSession'] as never });
    }

    /** Creates a CombatSession for the given session with provided participants. */
    async startCombat(
        sessionId: number,
        participants: Array<{ type: 'CHARACTER' | 'NPC'; id: string; initiativeRoll?: number }>,
    ): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        if (session.combatSession) return { success: false, errorCode: 'COMBAT_ALREADY_ACTIVE', message: 'Combat already active' };

        const combatants: Combatant[] = await Promise.all(participants.map(async (p) => {
            const roll = p.initiativeRoll ?? this.dice.d20();
            let hp = 0;
            let maxHp = 0;
            let namedNpc = false;

            if (p.type === 'CHARACTER') {
                const char = await this.em.findOne(Character, { id: parseInt(p.id, 10) });
                hp = char?.hp ?? 0;
                maxHp = char?.maxHp ?? 0;
            } else {
                const npc = await this.em.findOne(Npc, { id: parseInt(p.id, 10) });
                hp = npc?.hp ?? 10;
                maxHp = npc?.maxHp ?? hp;
                namedNpc = npc?.hp !== null;
            }

            return {
                id: p.id,
                type: p.type,
                name: p.id,
                initiativeRoll: roll,
                currentHp: hp,
                maxHp,
                conditions: [],
                usedAction: false,
                usedBonusAction: false,
                usedReaction: false,
                movementUsed: 0,
                namedNpc,
            };
        }));

        combatants.sort((a, b) => b.initiativeRoll - a.initiativeRoll);

        const cs = this.em.create(CombatSession, {
            session: this.em.getReference(GameSession, sessionId),
            combatants,
            currentTurnIndex: 0,
            roundNumber: 1,
        });
        this.em.persist(cs);
        await this.em.flush();

        return { success: true, data: { combatants, currentTurnIndex: 0, roundNumber: 1 } };
    }

    /** Advances initiative to the next combatant, resetting the previous combatant's action economy. */
    async advanceInitiative(sessionId: number): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        if (!session.combatSession) return { success: false, errorCode: 'NO_ACTIVE_COMBAT', message: 'No active combat' };

        const cs = session.combatSession;
        const total = cs.combatants.length;

        // Reset current combatant action economy
        const current = cs.combatants[cs.currentTurnIndex];
        if (current) {
            current.usedAction = false;
            current.usedBonusAction = false;
            current.usedReaction = false;
            current.movementUsed = 0;
        }

        const nextIndex = cs.currentTurnIndex + 1;
        const isNewRound = nextIndex >= total;
        cs.currentTurnIndex = isNewRound ? 0 : nextIndex;
        if (isNewRound) cs.roundNumber += 1;

        await this.em.flush();

        return {
            success: true,
            data: {
                currentTurnIndex: cs.currentTurnIndex,
                roundNumber: cs.roundNumber,
                currentCombatant: cs.combatants[cs.currentTurnIndex],
            },
        };
    }

    /** Applies damage to a character or NPC combatant. */
    async applyDamage(
        sessionId: number,
        targetId: string,
        amount: number,
        _damageType: string,
    ): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        const cs = session.combatSession;
        const combatant = cs?.combatants.find((c) => c.id === targetId);

        let newHp: number;
        let maxHpForMassive: number;

        if (combatant?.type === 'CHARACTER') {
            const char = await this.em.findOne(Character, { id: parseInt(targetId, 10) });
            if (!char) return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Character ${targetId} not found` };

            maxHpForMassive = char.maxHp;
            newHp = Math.max(0, char.hp - amount);
            char.hp = newHp;
            if (combatant) combatant.currentHp = newHp;
            await this.em.flush();
        } else if (combatant?.type === 'NPC' && cs) {
            maxHpForMassive = combatant.maxHp;
            newHp = Math.max(0, combatant.currentHp - amount);
            combatant.currentHp = newHp;
            await this.em.flush();
        } else {
            return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Combatant ${targetId} not found in combat` };
        }

        const downed = newHp === 0;
        const massiveDamage = amount >= maxHpForMassive ? true : undefined;

        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('DAMAGE', targetId, session.campaignId));

        return { success: true, data: { newHp, downed, ...(massiveDamage ? { massiveDamage } : {}) } };
    }

    /** Heals a character or NPC combatant. */
    async heal(sessionId: number, targetId: string, amount: number): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        const cs = session.combatSession;
        const combatant = cs?.combatants.find((c) => c.id === targetId);

        if (combatant?.type === 'CHARACTER') {
            const char = await this.em.findOne(Character, { id: parseInt(targetId, 10) });
            if (!char) return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Character ${targetId} not found` };

            const wasDown = char.hp === 0;
            char.hp = Math.min(char.maxHp, char.hp + amount);
            if (combatant) combatant.currentHp = char.hp;
            if (wasDown) {
                char.deathSaveSuccesses = 0;
                char.deathSaveFailures = 0;
            }
            await this.em.flush();
            this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('DAMAGE', targetId, session.campaignId));
            return { success: true, data: { newHp: char.hp } };
        }

        if (combatant?.type === 'NPC' && cs) {
            combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + amount);
            await this.em.flush();
            this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('DAMAGE', targetId, session.campaignId));
            return { success: true, data: { newHp: combatant.currentHp } };
        }

        return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Target ${targetId} not found` };
    }

    /** Applies a condition to a combatant (idempotent). */
    async applyCondition(sessionId: number, targetId: string, condition: string): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        const cs = session.combatSession;
        const combatant = cs?.combatants.find((c) => c.id === targetId);
        if (!combatant) return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Target ${targetId} not found` };

        if (!combatant.conditions.includes(condition)) {
            combatant.conditions.push(condition);
            if (combatant.type === 'CHARACTER') {
                const char = await this.em.findOne(Character, { id: parseInt(targetId, 10) });
                if (char && !char.conditions.includes(condition)) {
                    char.conditions = [...char.conditions, condition];
                }
            }
            await this.em.flush();
        }

        return { success: true, data: { conditions: combatant.conditions } };
    }

    /** Removes a condition from a combatant (idempotent). */
    async removeCondition(sessionId: number, targetId: string, condition: string): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };

        const cs = session.combatSession;
        const combatant = cs?.combatants.find((c) => c.id === targetId);
        if (!combatant) return { success: false, errorCode: 'TARGET_NOT_FOUND', message: `Target ${targetId} not found` };

        combatant.conditions = combatant.conditions.filter((c) => c !== condition);
        if (combatant.type === 'CHARACTER') {
            const char = await this.em.findOne(Character, { id: parseInt(targetId, 10) });
            if (char) {
                char.conditions = char.conditions.filter((c: string) => c !== condition);
            }
        }
        await this.em.flush();

        return { success: true, data: { conditions: combatant.conditions } };
    }

    /** Rolls a death save for a character. */
    async rollDeathSave(characterId: number): Promise<{
        success: true;
        data: { outcome: 'ONGOING' | 'STABILISED' | 'DEAD'; successes?: number; failures?: number; natural20?: boolean };
    } | CombatError> {
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        const roll = this.dice.d20();

        if (roll === 20) {
            char.hp = 1;
            char.deathSaveSuccesses = 0;
            char.deathSaveFailures = 0;
            await this.em.flush();
            return { success: true, data: { outcome: 'STABILISED', natural20: true } };
        }

        if (roll === 1) {
            char.deathSaveFailures += 2;
        } else if (roll >= 10) {
            char.deathSaveSuccesses += 1;
        } else {
            char.deathSaveFailures += 1;
        }

        if (char.deathSaveSuccesses >= 3) {
            char.hp = 1;
            char.deathSaveSuccesses = 0;
            char.deathSaveFailures = 0;
            await this.em.flush();
            return { success: true, data: { outcome: 'STABILISED' } };
        }

        if (char.deathSaveFailures >= 3) {
            char.isDead = true;
            await this.em.flush();
            return { success: true, data: { outcome: 'DEAD' } };
        }

        await this.em.flush();
        return {
            success: true,
            data: {
                outcome: 'ONGOING',
                successes: char.deathSaveSuccesses,
                failures: char.deathSaveFailures,
            },
        };
    }

    /** Sets hp = 1 and resets death save counters. */
    async stabilise(characterId: number): Promise<CombatOutcome> {
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        char.hp = 1;
        char.deathSaveSuccesses = 0;
        char.deathSaveFailures = 0;
        await this.em.flush();

        return { success: true, data: { hp: 1 } };
    }

    /** Sets Character.isDead = true, bypassing death saves. */
    async instantDeath(sessionId: number, characterId: number): Promise<CombatOutcome> {
        const session = await this.em.findOne(GameSession, { id: sessionId });
        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        char.isDead = true;
        char.hp = 0;
        await this.em.flush();

        if (session) {
            this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('DAMAGE', String(characterId), session.campaignId));
        }

        return { success: true, data: { isDead: true } };
    }

    /** Ends combat: persists NPC HP, syncs character conditions, deletes CombatSession. */
    async endCombat(sessionId: number): Promise<CombatOutcome> {
        const session = await this.loadSession(sessionId);
        if (!session) return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        if (!session.combatSession) return { success: false, errorCode: 'NO_ACTIVE_COMBAT', message: 'No active combat' };

        const cs = session.combatSession;

        // Persist final HP for named NPCs
        for (const combatant of cs.combatants) {
            if (combatant.type === 'NPC' && combatant.namedNpc) {
                const npc = await this.em.findOne(Npc, { id: parseInt(combatant.id, 10) });
                if (npc) {
                    npc.hp = combatant.currentHp;
                }
            }
        }

        // Sync character conditions (remove combat-only conditions)
        for (const combatant of cs.combatants) {
            if (combatant.type === 'CHARACTER') {
                const char = await this.em.findOne(Character, { id: parseInt(combatant.id, 10) });
                if (char) {
                    char.conditions = combatant.conditions.filter((c) => !COMBAT_ONLY_CONDITIONS.has(c));
                }
            }
        }

        this.em.remove(cs);
        session.combatSession = null;
        await this.em.flush();

        return { success: true, data: {} };
    }
}
