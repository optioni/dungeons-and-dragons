import {
    describe, expect, it, vi,
} from 'vitest';

import { LevelingService } from './leveling.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Optional: () => () => {},
}));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeCharacter(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        level: 3,
        maxHp: 25,
        spellSlots: [{ level: 1, total: 3, used: 0 }] as Array<{ level: number; total: number; used: number }>,
        // CON +2
        /* eslint-disable @typescript-eslint/naming-convention */
        abilityScores: {
            STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10,
        },
        /* eslint-enable @typescript-eslint/naming-convention */
        srdClass: { hitDie: 8, index: 'wizard' },
        ...overrides,
    };
}

function makeSession(overrides: Record<string, unknown> = {}) {
    return { id: 1, levelUpPending: false, ...overrides };
}

function makeEm(char: ReturnType<typeof makeCharacter> | null = makeCharacter(), session = makeSession()) {
    return {
        findOne: vi.fn().mockImplementation((entity: unknown) => {
            const name = String(entity);
            if (name.includes('GameSession')) {
                return Promise.resolve(session);
            }

            return Promise.resolve(char);
        }),
        flush: vi.fn(),
    };
}

describe('LevelingService', () => {
    describe('triggerLevelUp', () => {
        it('sets levelUpPending and returns new level payload', async () => {
            const char = makeCharacter({ level: 3 });
            const session = makeSession({ levelUpPending: false });
            const em = makeEm(char, session);
            const service = new LevelingService(em as never);
            const result = await service.triggerLevelUp(1, 1);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newLevel).toBe(4);
                expect(session.levelUpPending).toBe(true);
            }
        });

        it('does not increment Character.level immediately', async () => {
            const char = makeCharacter({ level: 3 });
            const session = makeSession();
            const em = makeEm(char, session);
            const service = new LevelingService(em as never);
            await service.triggerLevelUp(1, 1);
            expect(char.level).toBe(3);
        });

        it('returns LEVEL_UP_ALREADY_PENDING when flag is already set', async () => {
            const char = makeCharacter();
            const session = makeSession({ levelUpPending: true });
            const em = makeEm(char, session);
            const service = new LevelingService(em as never);
            const result = await service.triggerLevelUp(1, 1);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('LEVEL_UP_ALREADY_PENDING');
        });
    });

    describe('applyLevelUp', () => {
        it('increments level and applies ASI choices', async () => {
            const char = makeCharacter({ level: 3, maxHp: 25 });
            const session = makeSession({ levelUpPending: true });
            const em = makeEm(char, session);
            const service = new LevelingService(em as never);
            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await service.applyLevelUp(1, 1, { abilityScoreImprovements: { STR: 2 } }, 7);
            /* eslint-enable @typescript-eslint/naming-convention */
            expect(result.success).toBe(true);
            expect(char.level).toBe(4);
            expect((char.abilityScores as Record<string, number>).STR).toBe(12);
            // 7 rolled + CON mod +2
            expect(char.maxHp).toBe(25 + 7 + 2);
            expect(session.levelUpPending).toBe(false);
        });

        it('returns INVALID_ASI_CHOICES when increments total > 2', async () => {
            const char = makeCharacter();
            const session = makeSession({ levelUpPending: true });
            const em = makeEm(char, session);
            const service = new LevelingService(em as never);
            /* eslint-disable @typescript-eslint/naming-convention */
            const result = await service.applyLevelUp(1, 1, { abilityScoreImprovements: { STR: 2, DEX: 1 } }, 5);
            /* eslint-enable @typescript-eslint/naming-convention */
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('INVALID_ASI_CHOICES');
        });
    });

    describe('useSpellSlot', () => {
        it('increments used count for a valid slot', async () => {
            const char = makeCharacter({ spellSlots: [{ level: 1, total: 3, used: 1 }] });
            const em = makeEm(char);
            const service = new LevelingService(em as never);
            const result = await service.useSpellSlot(1, 1);
            expect(result.success).toBe(true);
            expect((char.spellSlots[0] as { used: number }).used).toBe(2);
        });

        it('returns NO_SPELL_SLOT_AVAILABLE when all slots used', async () => {
            const char = makeCharacter({ spellSlots: [{ level: 1, total: 2, used: 2 }] });
            const em = makeEm(char);
            const service = new LevelingService(em as never);
            const result = await service.useSpellSlot(1, 1);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('NO_SPELL_SLOT_AVAILABLE');
        });

        it('returns NO_SPELL_SLOT_AVAILABLE for empty spell slots', async () => {
            const char = makeCharacter({ spellSlots: [] });
            const em = makeEm(char);
            const service = new LevelingService(em as never);
            const result = await service.useSpellSlot(1, 1);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('NO_SPELL_SLOT_AVAILABLE');
        });
    });
});
