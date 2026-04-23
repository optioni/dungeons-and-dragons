import {
    describe, expect, it, vi,
} from 'vitest';

import { TriggerSpellPrepHandler } from './trigger-spell-prep.handler.js';

describe('TriggerSpellPrepHandler', () => {
    it('returns success for a prepared spellcaster in the active session', async () => {
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce({ id: 1, campaign: { id: 10 } })
                .mockResolvedValueOnce({
                    id: 2,
                    campaign: { id: 10 },
                    srdClass: { index: 'wizard', name: 'Wizard' },
                }),
        };

        const handler = new TriggerSpellPrepHandler(em as never);
        const result = await handler.execute(1, { characterId: 2 });

        expect(result).toEqual({
            success: true,
            data: {
                characterId: 2,
                class: 'Wizard',
            },
        });
    });

    it('returns a structured error for a non-prepared caster', async () => {
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce({ id: 1, campaign: { id: 10 } })
                .mockResolvedValueOnce({
                    id: 2,
                    campaign: { id: 10 },
                    srdClass: { index: 'sorcerer', name: 'Sorcerer' },
                }),
        };

        const handler = new TriggerSpellPrepHandler(em as never);
        const result = await handler.execute(1, { characterId: 2 });

        expect(result).toMatchObject({
            success: false,
            errorCode: 'SPELL_PREP_NOT_SUPPORTED',
        });
    });
});
