import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

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
    NotFoundException: class NotFoundException extends Error {},
}));

import { RestService } from './rest.service.js';
import { DiceService } from './dice.service.js';

function makeCharacter(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        level: 4,
        hp: 10,
        maxHp: 40,
        spellSlots: [{ level: 1, total: 4, used: 2 }, { level: 2, total: 3, used: 3 }],
        hitDiceRemaining: 2,
        deathSaveSuccesses: 1,
        deathSaveFailures: 2,
        abilityScores: { STR: 10, DEX: 10, CON: 14, INT: 10, WIS: 10, CHA: 10 }, // CON +2
        srdClass: { hitDie: 10, index: 'fighter' },
        ...overrides,
    };
}

function makeEm(char: ReturnType<typeof makeCharacter> | null = makeCharacter(), campaign: Record<string, unknown> | null = null) {
    return {
        findOne: vi.fn().mockImplementation((entity: unknown) => {
            if (String(entity).includes('Campaign')) return Promise.resolve(campaign);
            return Promise.resolve(char);
        }),
        flush: vi.fn(),
    };
}

describe('RestService', () => {
    let service: RestService;

    describe('takeShortRest', () => {
        it('restores HP and decrements hitDiceRemaining', async () => {
            const char = makeCharacter({ hp: 10, maxHp: 40, hitDiceRemaining: 3 });
            const em = makeEm(char);
            // Use seeded dice so we can predict the roll
            const dice = DiceService.withSeed('short-rest');
            service = new RestService(em as never, dice);
            const result = await service.takeShortRest(1, 2);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hitDiceSpent).toBe(2);
                expect(char.hitDiceRemaining).toBe(1);
                expect(char.hp).toBeGreaterThanOrEqual(10); // HP should increase
            }
        });

        it('caps hit dice spending at remaining', async () => {
            const char = makeCharacter({ hitDiceRemaining: 1 });
            const em = makeEm(char);
            service = new RestService(em as never, DiceService.withSeed('cap'));
            const result = await service.takeShortRest(1, 5);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hitDiceSpent).toBe(1);
            }
        });

        it('zero hit dice requested is valid and does nothing', async () => {
            const char = makeCharacter({ hp: 10, hitDiceRemaining: 3 });
            const em = makeEm(char);
            service = new RestService(em as never, new DiceService());
            const result = await service.takeShortRest(1, 0);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hitDiceSpent).toBe(0);
                expect(char.hp).toBe(10); // unchanged
            }
        });

        it('does not modify inGameDate', async () => {
            const char = makeCharacter();
            const campaign = { id: 10, inGameDate: 'Day 3', userId: 1 };
            const em = makeEm(char, campaign);
            service = new RestService(em as never, DiceService.withSeed('no-date'));
            await service.takeShortRest(1, 1);
            expect(campaign.inGameDate).toBe('Day 3'); // unchanged
        });
    });

    describe('takeLongRest', () => {
        it('restores HP to max and all spell slots', async () => {
            const char = makeCharacter({ hp: 5, maxHp: 40, spellSlots: [{ level: 1, total: 4, used: 4 }] });
            const em = makeEm(char);
            service = new RestService(em as never, new DiceService());
            const result = await service.takeLongRest(1, 10);
            expect(result.success).toBe(true);
            expect(char.hp).toBe(40);
            expect((char.spellSlots as Array<{ used: number }>)[0]!.used).toBe(0);
        });

        it('resets death save counters', async () => {
            const char = makeCharacter({ deathSaveSuccesses: 2, deathSaveFailures: 1 });
            const em = makeEm(char);
            service = new RestService(em as never, new DiceService());
            await service.takeLongRest(1, 10);
            expect(char.deathSaveSuccesses).toBe(0);
            expect(char.deathSaveFailures).toBe(0);
        });

        it('restores hit dice up to half level rounded up', async () => {
            // Level 4 character with 0 hit dice remaining → restore min(4, ceil(4/2)) = 2
            const char = makeCharacter({ level: 4, hitDiceRemaining: 0 });
            const em = makeEm(char);
            service = new RestService(em as never, new DiceService());
            await service.takeLongRest(1, 10);
            expect(char.hitDiceRemaining).toBe(2);
        });

        it('does not restore more hit dice than level', async () => {
            const char = makeCharacter({ level: 4, hitDiceRemaining: 3 });
            const em = makeEm(char);
            service = new RestService(em as never, new DiceService());
            await service.takeLongRest(1, 10);
            // 3 + 2 = 5 but cap is 4 (= level)
            expect(char.hitDiceRemaining).toBe(4);
        });
    });
});
