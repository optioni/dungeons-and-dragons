import { type AnyEntity, type FilterQuery } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { fromGlobalId } from 'graphql-relay';

/**
 * Represents an operator used for comparison in queries.
 */
export type Operator = '=' | '!' | 'ilike' | '>' | '>=' | '<' | '<=' | 'in' | 'not in';

/**
 * Represents a SQL operator.
 */
export type SqlOperator = 'eq' | 'ne' | 'lk' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notin';

/**
 * Represents a resolver function used for custom field filtering.
 * @template T - The type of the entity.
 * @template V - The type of the value.
 * @param operator - The operator used in the query.
 * @param value - The value used in the query.
 * @returns A FilterQuery condition for the field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResolverFunction<T extends AnyEntity, V = any> = (
    operator: Operator,
    value: V,
) => FilterQuery<T>;

/**
 * Interface representing the "where" clause for Relay queries.
 */
export interface RelayWhere {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    AND?: RelayWhere[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    OR?: RelayWhere[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

@Injectable()
export class WhereService {
    private readonly sqlToOperator: Record<SqlOperator, Operator> = {
        eq: '=',
        ne: '!',
        lk: 'ilike',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        in: 'in',
        notin: 'not in',
    };

    private readonly sqlToFilterOp: Record<SqlOperator, string> = {
        eq: '$eq',
        ne: '$ne',
        lk: '$ilike',
        gt: '$gt',
        gte: '$gte',
        lt: '$lt',
        lte: '$lte',
        in: '$in',
        notin: '$nin',
    };

    /**
     * Recursively builds a FilterQuery from the provided where conditions.
     *
     * @template T - The entity type.
     * @param where - The conditions to apply.
     * @param resolvers - Optional resolvers for custom field filtering.
     * @returns A FilterQuery representing the conditions.
     */
    loopWhere<T extends AnyEntity<T>>(
        where: RelayWhere,
        resolvers?: Record<string, ResolverFunction<T>>,
    ): FilterQuery<T> {
         
        const conditions: Array<FilterQuery<T>> = [];

        for (const fieldName of Object.keys(where)) {
            let field = fieldName;
            let value = where[field];

            if (value === undefined || field === 'AND' || field === 'OR') {
                continue;
            }

            let sqlOp: SqlOperator = 'eq';

            if (field.includes('_')) {
                const parts = field.split('_') as [string, SqlOperator];
                [field] = parts;

                if (!this.sqlToOperator[parts[1]]) {
                    throw new Error('Operator not found');
                }

                sqlOp = parts[1];
            }

            const filterOp = this.sqlToFilterOp[sqlOp];
            const humanOp = this.sqlToOperator[sqlOp];

            if ((field === 'id' || field.endsWith('Id')) && field !== 'userId') {
                value = Array.isArray(value)
                    ? value.map((id: string) => fromGlobalId(id).id)
                    : fromGlobalId(value as string).id;
            }

            if (filterOp === '$in' || filterOp === '$nin') {
                value = Array.isArray(value) ? value : [value];
            } else if (filterOp === '$ilike') {
                value = `%${value as string}%`;
            }

            if (resolvers?.[field]) {
                conditions.push(resolvers[field](humanOp, value));
            } else {
                if (value instanceof Date) {
                    value = value.toISOString();
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                conditions.push({ [field]: { [filterOp]: value } } as any as FilterQuery<T>);
            }
        }

        if (Array.isArray(where.OR) && where.OR.length > 0) {
            conditions.push({
                $or: where.OR.map((orQuery) => this.loopWhere<T>(orQuery, resolvers)),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any as FilterQuery<T>);
        }

        if (Array.isArray(where.AND) && where.AND.length > 0) {
            for (const andQuery of where.AND) {
                conditions.push(this.loopWhere<T>(andQuery, resolvers));
            }
        }

        if (conditions.length === 0) {
            return {} as FilterQuery<T>;
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { $and: conditions } as any as FilterQuery<T>;
    }

    /**
     * Returns a FilterQuery for the provided where conditions, or undefined if no conditions.
     *
     * @template T - The entity type.
     * @param where - The conditions to apply.
     * @param resolvers - Optional resolvers for custom field filtering.
     * @returns A FilterQuery or undefined if no conditions.
     */
    getWhere<T extends AnyEntity<T>>(
        where?: RelayWhere,
        resolvers?: Record<string, ResolverFunction<T>>,
    ): FilterQuery<T> | undefined {
        if (!where || Object.keys(where).length === 0) {
            return undefined;
        }

        return this.loopWhere<T>(where, resolvers);
    }
}
