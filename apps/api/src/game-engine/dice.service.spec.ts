import { describe, expect, it } from 'vitest';

import { DiceService, type RollError, type RollResult } from './dice.service.js';

describe('DiceService', () => {
    it('rolls a simple expression and returns total and rolls', () => {
        const dice = DiceService.withSeed('test');
        const result = dice.roll('2d6+3') as RollResult;
        expect(result.expression).toBe('2d6+3');
        expect(result.rolls).toHaveLength(2);
        for (const roll of result.rolls) {
            expect(roll).toBeGreaterThanOrEqual(1);
            expect(roll).toBeLessThanOrEqual(6);
        }

        expect(result.total).toBe(result.rolls.reduce((a: number, b: number) => a + b, 0) + 3);
    });

    it('produces deterministic results with the same seed', () => {
        const a = DiceService.withSeed('abc');
        const b = DiceService.withSeed('abc');
        expect((a.roll('1d20') as RollResult).total).toBe((b.roll('1d20') as RollResult).total);
    });

    it('produces different results with different seeds', () => {
        // This test has a tiny chance of false failure (same roll by chance), but seeds are deterministic.
        const results = new Set<number>();
        for (let index = 0; index < 20; index++) {
            results.add(DiceService.withSeed(`seed-${index}`).d20());
        }

        expect(results.size).toBeGreaterThan(1);
    });

    it('d20() returns a value between 1 and 20', () => {
        const dice = new DiceService();
        for (let index = 0; index < 50; index++) {
            const roll = dice.d20();
            expect(roll).toBeGreaterThanOrEqual(1);
            expect(roll).toBeLessThanOrEqual(20);
        }
    });

    it('supports subtraction modifiers', () => {
        const dice = DiceService.withSeed('sub');
        const result = dice.roll('1d6-2') as RollResult;
        expect(result.expression).toBe('1d6-2');
        expect(result.total).toBe(result.rolls[0]! - 2);
    });

    it('returns structured error for invalid expression', () => {
        const dice = new DiceService();
        const result = dice.roll('2x6') as RollError;
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INVALID_EXPRESSION');
    });

    it('supports keep-highest notation (advantage)', () => {
        const dice = DiceService.withSeed('kh');
        const result = dice.roll('2d20kh1') as RollResult;
        expect(result.rolls).toHaveLength(2);
        // total should be the higher of the two rolls
        expect(result.total).toBe(Math.max(...result.rolls));
    });

    it('supports keep-lowest notation (disadvantage)', () => {
        const dice = DiceService.withSeed('kl');
        const result = dice.roll('2d20kl1') as RollResult;
        expect(result.rolls).toHaveLength(2);
        expect(result.total).toBe(Math.min(...result.rolls));
    });

    it('returns all rolls including kept and dropped when using kh', () => {
        const dice = DiceService.withSeed('kh-all');
        const result = dice.roll('4d6kh3') as RollResult;
        expect(result.rolls).toHaveLength(4);
        // kept rolls sum
        const sorted = [...result.rolls].sort((a: number, b: number) => b - a);
        expect(result.total).toBe(sorted[0]! + sorted[1]! + sorted[2]!);
    });
});
