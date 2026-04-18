import { Injectable } from '@nestjs/common';

export interface RollResult {
    success: true;
    expression: string;
    total: number;
    rolls: number[];
}

export interface RollError {
    success: false;
    errorCode: 'INVALID_EXPRESSION';
    message: string;
}

export type RollOutcome = RollResult | RollError;

/** Regex: NdX, optional kh/kl N, optional +/-M */
const DICE_RE = /^(\d+)d(\d+)(?:k([hl])(\d+))?([+-]\d+)?$/i;

function mulberry32(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) >>> 0;
    }
    return hash;
}

/**
 * Thin injectable wrapper for dice rolling. Use `withSeed` in tests for deterministic results.
 */
@Injectable()
export class DiceService {
    private readonly rand: () => number;

    constructor(rand?: () => number) {
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

        const count = parseInt(match[1]!, 10);
        const sides = parseInt(match[2]!, 10);
        const keepType = match[3]?.toLowerCase() as 'h' | 'l' | undefined;
        const keepCount = match[4] !== undefined ? parseInt(match[4], 10) : undefined;
        const modifier = match[5] !== undefined ? parseInt(match[5], 10) : 0;

        if (count < 1 || sides < 1) {
            return {
                success: false,
                errorCode: 'INVALID_EXPRESSION',
                message: `Invalid dice count or sides in: "${expression}"`,
            };
        }

        const rolls: number[] = [];
        for (let i = 0; i < count; i++) {
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
