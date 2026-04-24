import { Injectable, Optional } from '@nestjs/common';

export interface RollResult {
    success: true
    expression: string
    total: number
    rolls: number[]
}

export interface RollError {
    success: false
    errorCode: 'INVALID_EXPRESSION'
    message: string
}

export type RollOutcome = RollResult | RollError;

/** Regex: NdX, optional kh/kl N, optional +/-M */
// eslint-disable-next-line require-unicode-regexp
const DICE_RE = /^(\d+)d(\d+)(?:k([hl])(\d+))?([+-]\d+)?$/i;

/* eslint-disable no-bitwise */
function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6D_2B_79_F5) >>> 0;
        let temporary = Math.imul(state ^ (state >>> 15), 1 | state);
        temporary = (temporary + Math.imul(temporary ^ (temporary >>> 7), 61 | temporary)) >>> 0;
        return ((temporary ^ (temporary >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function hashString(input: string): number {
    let hash = 0;
    for (let index = 0; index < input.length; index++) {
        // eslint-disable-next-line unicorn/prefer-code-point
        hash = Math.imul(31, hash) + input.charCodeAt(index) >>> 0;
    }

    return hash;
}
/* eslint-enable no-bitwise */

/**
 * Thin injectable wrapper for dice rolling. Use `withSeed` in tests for deterministic results.
 */
@Injectable()
export class DiceService {
    private readonly rand: () => number;

    constructor(@Optional() rand?: () => number) {
        this.rand = rand ?? (() => Math.random());
    }

    /** Returns a new DiceService using a deterministic PRNG seeded from `seed`. */
    static withSeed(seed: string): DiceService {
        return new DiceService(mulberry32(hashString(seed)));
    }

    /** Rolls a single d20 and returns the result (1–20). */
    d20(): number {
        return Math.floor(this.rand() * 20) + 1;
    }

    /**
     * Parses and rolls a dice expression.
     * Supports: NdX, NdX±M, NdXkhK, NdXklK, NdXkhK±M
     */
    roll(expression: string): RollOutcome {
        const match = DICE_RE.exec(expression.trim());
        if (!match) {
            return {
                success: false,
                errorCode: 'INVALID_EXPRESSION',
                message: `Cannot parse dice expression: "${expression}"`,
            };
        }

        const count = Number.parseInt(match[1]!, 10);
        const sides = Number.parseInt(match[2]!, 10);
        const keepType = match[3]?.toLowerCase() as 'h' | 'l' | undefined;
        const keepCount = match[4] === undefined ? undefined : Number.parseInt(match[4], 10);
        const modifier = match[5] === undefined ? 0 : Number.parseInt(match[5], 10);

        if (count < 1 || sides < 1) {
            return {
                success: false,
                errorCode: 'INVALID_EXPRESSION',
                message: `Invalid dice count or sides in: "${expression}"`,
            };
        }

        const rolls: number[] = [];
        for (let index = 0; index < count; index++) {
            rolls.push(Math.floor(this.rand() * sides) + 1);
        }

        let keptTotal: number;
        if (keepType !== undefined && keepCount !== undefined) {
            const sorted = [...rolls].sort((a, b) => (keepType === 'h' ? b - a : a - b));
            keptTotal = sorted.slice(0, keepCount).reduce((a, b) => a + b, 0);
        } else {
            keptTotal = rolls.reduce((a, b) => a + b, 0);
        }

        return {
            success: true,
            expression,
            total: keptTotal + modifier,
            rolls,
        };
    }
}
