import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Character } from '../../character/entities/character.entity.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';

const PREPARED_SPELLCASTER_CLASS_INDICES = new Set(['cleric', 'druid', 'wizard']);

/**
 * Validates that a character in the active session can enter the prepared-spell
 * workflow. The stream-side UI signal is emitted by the DM orchestrator after this
 * handler returns success.
 */
@Injectable()
export class TriggerSpellPrepHandler {
    constructor(private readonly em: EntityManager) {}

    /**
     * Returns a structured success envelope for Wizard, Cleric, and Druid
     * characters in the active session. All failures are reported as structured
     * tool results so the LLM can recover gracefully.
     */
    async execute(sessionId: number, input: { characterId: number }): Promise<ToolResult> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['campaign'] as never });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        const character = await this.em.findOne(
            Character,
            { id: input.characterId },
            { populate: ['campaign', 'srdClass'] as never },
        );
        if (!character) {
            return {
                success: false,
                errorCode: 'CHARACTER_NOT_FOUND',
                message: `Character ${input.characterId} not found`,
            };
        }

        if (character.campaign.id !== session.campaign.id) {
            return {
                success: false,
                errorCode: 'CHARACTER_NOT_IN_SESSION',
                message: `Character ${input.characterId} is not part of session ${sessionId}`,
            };
        }

        if (!PREPARED_SPELLCASTER_CLASS_INDICES.has(character.srdClass.index)) {
            return {
                success: false,
                errorCode: 'SPELL_PREP_NOT_SUPPORTED',
                message: `${character.srdClass.name} does not use prepared spells`,
            };
        }

        return {
            success: true,
            data: {
                characterId: character.id,
                class: character.srdClass.name,
            },
        };
    }
}
