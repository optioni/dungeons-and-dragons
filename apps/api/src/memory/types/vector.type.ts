import { Type } from '@mikro-orm/core';

/**
 * Custom MikroORM type for pgvector `vector(1024)` columns.
 * Serializes number arrays to/from the pgvector string format `[1.0,2.0,...]`.
 */
export class VectorType extends Type<number[] | null, string | null> {
    convertToDatabaseValue(value: number[] | null): string | null {
        if (!value) return null;
        return `[${value.join(',')}]`;
    }

    convertToJSValue(value: string | null): number[] | null {
        if (!value) return null;
        try {
            return JSON.parse(value) as number[];
        } catch {
            return null;
        }
    }

    getColumnType(): string {
        return 'vector(1024)';
    }
}
