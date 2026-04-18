import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

// ── Framework mocks ──────────────────────────────────────────────────────────
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    InputType: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    NotFoundException: class NotFoundException extends Error {},
}));

import { DiceService } from './dice.service.js';
import { DiceChecksService } from './dice-checks.service.js';

function makeCharacter(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        level: 3,
        abilityScores: { STR: 10, DEX: 16, CON: 12, INT: 8, WIS: 14, CHA: 10 },
        skillProficiencies: {
            Stealth: 'proficient',
            Perception: 'expert',
            Persuasion: 'none',
            Acrobatics: 'none',
            'Animal Handling': 'none',
            Arcana: 'none',
            Athletics: 'none',
            Deception: 'none',
            History: 'none',
            Insight: 'none',
            Intimidation: 'none',
            Investigation: 'none',
            Medicine: 'none',
            Nature: 'none',
            Performance: 'none',
            Religion: 'none',
            'Sleight of Hand': 'none',
            Survival: 'none',
        },
        proficiencyBonus: 2, // level 3 → floor((3-1)/4)+2 = 2
        ...overrides,
    };
}

function makeEm(character: ReturnType<typeof makeCharacter> | null = makeCharacter()) {
    return {
        findOne: vi.fn().mockResolvedValue(character),
    };
}

describe('DiceChecksService', () => {
    let service: DiceChecksService;
    let seededDice: DiceService;

    beforeEach(() => {
        seededDice = DiceService.withSeed('test');
        service = new DiceChecksService(null as never);
    });

    describe('rollDice', () => {
        it('parses expression and returns total and rolls', () => {
            service = new DiceChecksService(null as never, DiceService.withSeed('roll'));
            const result = service.rollDice('2d6+3');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.expression).toBe('2d6+3');
                expect(result.rolls).toHaveLength(2);
                expect(result.total).toBe(result.rolls.reduce((a: number, b: number) => a + b, 0) + 3);
            }
        });

        it('returns error for invalid expression', () => {
            service = new DiceChecksService(null as never, new DiceService());
            const result = service.rollDice('2x6');
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('INVALID_EXPRESSION');
        });
    });

    describe('checkSkill', () => {
        it('applies proficiency bonus for a proficient skill', async () => {
            const char = makeCharacter(); // DEX +3, Stealth proficient
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('skill-prof'));
            const result = await service.checkSkill(1, 'Stealth', 15);
            expect(result.success).toBe(true);
            if (result.success) {
                // modifier = DEX mod (+3) + proficiency (+2) = +5
                expect(result.data.modifier).toBe(5);
            }
        });

        it('applies double proficiency for expert skill', async () => {
            const char = makeCharacter(); // Perception expert
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('expert'));
            const result = await service.checkSkill(1, 'Perception', 10);
            expect(result.success).toBe(true);
            if (result.success) {
                // WIS mod = +2 (WIS 14), double proficiency = +4 → total modifier +6
                expect(result.data.modifier).toBe(6);
            }
        });

        it('omits proficiency for non-proficient skill', async () => {
            const char = makeCharacter(); // Persuasion 'none', CHA 10 → mod 0
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('noprof'));
            const result = await service.checkSkill(1, 'Persuasion', 12);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modifier).toBe(0);
            }
        });

        it('returns CHARACTER_NOT_FOUND when character missing', async () => {
            const em = makeEm(null);
            service = new DiceChecksService(em as never);
            const result = await service.checkSkill(999, 'Stealth', 15);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('CHARACTER_NOT_FOUND');
        });
    });

    describe('checkAbility', () => {
        it('applies raw ability modifier without proficiency', async () => {
            const char = makeCharacter(); // STR 10 → mod 0
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('ability'));
            const result = await service.checkAbility(1, 'STR', 13);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modifier).toBe(0);
            }
        });

        it('returns correct modifier for high DEX', async () => {
            const char = makeCharacter(); // DEX 16 → mod +3
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('dex'));
            const result = await service.checkAbility(1, 'DEX', 10);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modifier).toBe(3);
            }
        });

        it('does not include proficiency even when character has proficiency in a related skill', async () => {
            const char = makeCharacter(); // Stealth proficient but check_ability uses raw DEX
            const em = makeEm(char);
            service = new DiceChecksService(em as never, DiceService.withSeed('raw-dex'));
            const result = await service.checkAbility(1, 'DEX', 10);
            expect(result.success).toBe(true);
            if (result.success) {
                // raw DEX mod is +3, no proficiency
                expect(result.data.modifier).toBe(3);
            }
        });
    });
});
