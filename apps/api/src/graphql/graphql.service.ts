import {
    type AnyEntity,
    EntityRepository,
    type FilterQuery,
    helper,
    type QueryBuilder,
    type QueryOrderMap,
} from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { type ConnectionArgs, getMeta } from './relay';
import { type OrderBy, OrderByDirection } from './relay/order-by.input';
import { type RelayWhere, ResolverFunction, WhereService } from './where.service';

/**
 * Represents a map of order fields and their corresponding directions.
 */
export type OrderMap = Map<string, OrderByDirection>;

/**
 * Represents a cursor object.
 * A cursor is a record that maps keys to numbers or strings.
 */
export type Cursor = Record<string, number | string>;

/**
 * Options for the find operation.
 */
export interface FindOptions<T extends AnyEntity> {
    resolvers?: Record<string, ResolverFunction<T>>
}

@Injectable()
export class GraphqlService {
    constructor(private readonly whereService: WhereService) {}

    /**
     * Retrieves the cursor for the given entity based on the provided orderBy map.
     * @param entity - The entity for which to retrieve the cursor.
     * @param orderBy - The map specifying the order of the cursor properties.
     * @returns The cursor object containing the serialized primary key and ordered properties.
     */
    getCursor<T extends AnyEntity<T>>(entity: T, orderBy: OrderMap): Cursor {
        const cursor: Cursor = {
            id: helper(entity).getSerializedPrimaryKey(),
        };

        for (const key of orderBy.keys()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cursor[key] = entity[key as keyof T] as any;
        }

        return cursor;
    }

    /**
     * Retrieves the cursor value based on the input value.
     * If the input value is a boolean, it returns 1 for true and 0 for false.
     * Otherwise, it returns the input value as is.
     *
     * @param value - The value to retrieve the cursor value from.
     * @returns The cursor value.
     */
    getCursorValue(value: string | number | boolean): number | string {
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }

        return value;
    }

    /**
     * Converts an array of OrderBy objects into an OrderMap.
     * @param order - The array of OrderBy objects.
     * @returns The OrderMap containing the field-direction pairs.
     */
    getOrder(order?: OrderBy[]): OrderMap {
        const orderMap = new Map<string, OrderByDirection>();

        if (order) {
            for (const { field, direction } of order) {
                orderMap.set(field, direction);
            }
        }

        return orderMap;
    }

    /**
     * Converts an OrderMap to a QueryOrderMap.
     *
     * @template T - The type of the entity.
     * @param {OrderMap} map - The OrderMap to convert.
     * @returns {QueryOrderMap<T>} - The converted QueryOrderMap.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getQueryOrderMap<T extends AnyEntity = any>(map: OrderMap): QueryOrderMap<T> {
        const order: QueryOrderMap<T> = {};

        for (const [key, value] of map.entries()) {
            order[key as keyof QueryOrderMap<T>] = value;
        }

        return order;
    }

    /**
     * Builds cursor pagination conditions as a FilterQuery.
     *
     * @template T - The type of the entity being queried.
     * @param cursor - The cursor object containing the values for pagination.
     * @param orderBy - The map of column names and their corresponding sort directions.
     * @param invert - A boolean indicating whether to invert the sort direction.
     * @returns A FilterQuery representing the cursor conditions.
     */
    getQueryConditions<T extends AnyEntity<T>>(
        cursor: Cursor,
        orderBy: OrderMap,
        invert: boolean,
    ): FilterQuery<T> {
        if (orderBy.size === 0) {
            orderBy.set('id', OrderByDirection.ASC);
        }

        const keys = [...orderBy.keys()].filter((key) => cursor[key] !== undefined);

        const orConditions: Array<FilterQuery<T>> = [];

        for (const [index, key] of keys.entries()) {
            let comparatorOp = orderBy.get(key) === 'DESC' ? '$lt' : '$gt';

            if (invert) {
                comparatorOp = comparatorOp === '$lt' ? '$gt' : '$lt';
            }

            const andConditions: Array<FilterQuery<T>> = [];

            for (const item of keys.slice(0, index)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                andConditions.push({ [item]: { $eq: this.getCursorValue(cursor[item]) } } as any as FilterQuery<T>);
            }

            const keyCondition = {
                [key]: { [comparatorOp]: this.getCursorValue(cursor[key]) },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any as FilterQuery<T>;
            andConditions.push(keyCondition);

            if (andConditions.length === 1) {
                orConditions.push(andConditions[0]);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                orConditions.push({ $and: andConditions } as any as FilterQuery<T>);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { $or: orConditions } as any as FilterQuery<T>;
    }

    /**
     * Swaps the order of the keys and values in the given OrderMap.
     * @param orderBy The OrderMap to swap the order of.
     * @returns The OrderMap with the order of keys and values swapped.
     */
    swapOrder(orderBy: OrderMap): OrderMap {
        const swappedOrderBy = new Map<string, OrderByDirection>();

        for (const [key, value] of orderBy.entries()) {
            swappedOrderBy.set(key, value === OrderByDirection.DESC ? OrderByDirection.ASC : OrderByDirection.DESC);
        }

        return swappedOrderBy;
    }

    /**
     * Finds and paginates entities based on the provided criteria.
     *
     * @template T - The type of the entity.
     * @param {EntityRepository<T> | QueryBuilder<T>} repositoryOrQueryBuilder - The entity repository or query builder.
     * @param {RelayWhere | undefined} where - The filter criteria.
     * @param {OrderBy[] | undefined} order - The order criteria.
     * @param {ConnectionArgs} connArgs - The connection arguments for pagination.
     * @param {FindOptions<T>} [options] - Additional options for the find operation.
     * @returns {Promise<Connection<T>>} - A promise that resolves to the paginated connection of entities.
     */
    async findAndPaginate<T extends AnyEntity<T>>(
        repositoryOrQueryBuilder: EntityRepository<T> | QueryBuilder<T>,
        where: RelayWhere | undefined,
        order: OrderBy[] | undefined,
        connArgs: ConnectionArgs,
        options?: FindOptions<T>,
    ): Promise<Connection<T>> {
        let orderBy = this.getOrder(order);
        const qb
            = repositoryOrQueryBuilder instanceof EntityRepository
                ? repositoryOrQueryBuilder.createQueryBuilder()
                : repositoryOrQueryBuilder;
        const limit = connArgs.first ?? connArgs.last ?? 25;
        const meta = getMeta(connArgs);

        // Build base query with where conditions
        let baseQb = qb.clone();
        const whereFilter = this.whereService.getWhere<T>(where, options?.resolvers);

        if (whereFilter) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            baseQb = baseQb.andWhere(whereFilter as any);
        }

        if (meta.pagingType !== 'none') {
            orderBy.set('id', OrderByDirection.ASC);
        }

        if (meta.pagingType === 'forward' && meta.after) {
            const cursor: Cursor = JSON.parse(Buffer.from(meta.after, 'base64').toString());
            const cursorConditions = this.getQueryConditions<T>(cursor, orderBy, false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            baseQb = baseQb.andWhere(cursorConditions as any);
        } else if (meta.pagingType === 'backward') {
            orderBy = this.swapOrder(orderBy);

            if (meta.before) {
                const cursor: Cursor = JSON.parse(Buffer.from(meta.before, 'base64').toString());
                const cursorConditions = this.getQueryConditions<T>(cursor, orderBy, true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                baseQb = baseQb.andWhere(cursorConditions as any);
            }
        }

        const entities = await baseQb
            .orderBy(this.getQueryOrderMap(orderBy))
            .limit(limit + 1)
            .getResultList();

        const hasMore = entities.length > limit;

        const edges = entities.slice(0, limit).map((entity) => ({
            cursor: Buffer.from(JSON.stringify(this.getCursor<T>(entity, orderBy))).toString('base64'),
            node: entity,
        }));

        if (meta.pagingType === 'backward') {
            edges.reverse();
        }

        let hasNextPage: boolean;
        let hasPreviousPage: boolean;

        if (meta.pagingType === 'forward') {
            hasNextPage = hasMore;
            hasPreviousPage = Boolean(meta.after);
        } else if (meta.pagingType === 'backward') {
            hasNextPage = Boolean(meta.before);
            hasPreviousPage = hasMore;
        } else {
            hasNextPage = hasMore;
            hasPreviousPage = false;
        }

        return {
            edges,
            pageInfo: {
                startCursor: edges.length > 0 ? edges[0].cursor : null,
                endCursor: edges.length > 0 ? (edges[edges.length - 1]?.cursor ?? null) : null,
                hasNextPage,
                hasPreviousPage,
            },
        };
    }

    /**
     * Finds a single entity that matches the specified criteria.
     *
     * @template T - The type of the entity.
     * @param repositoryOrQueryBuilder - The repository or query builder to use for the search.
     * @param where - The criteria to filter the search.
     * @param options - Additional options for the search.
     * @returns A promise that resolves to the found entity, or undefined if no entity is found.
     */
    async findOne<T extends AnyEntity<T>>(
        repositoryOrQueryBuilder: EntityRepository<T> | QueryBuilder<T>,
        where: RelayWhere,
        options?: FindOptions<T>,
    ): Promise<T | undefined> {
        const qb
            = repositoryOrQueryBuilder instanceof EntityRepository
                ? repositoryOrQueryBuilder.createQueryBuilder()
                : repositoryOrQueryBuilder;

        const whereFilter = this.whereService.getWhere<T>(where, options?.resolvers);

        if (whereFilter) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (await qb.clone().andWhere(whereFilter as any).getSingleResult()) ?? undefined;
        }

        return (await qb.getSingleResult()) ?? undefined;
    }
}
