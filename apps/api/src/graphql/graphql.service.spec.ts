import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphqlService } from './graphql.service';
import { OrderByDirection } from './relay/order-by.input';
import { type WhereService } from './where.service';

vi.mock('@mikro-orm/postgresql', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        helper: vi.fn(() => ({
            getSerializedPrimaryKey: vi.fn(() => '123'),
        })),
    };
});

describe('GraphqlService', () => {
    let service: GraphqlService;
    let whereService: WhereService;

    beforeEach(() => {
        whereService = {
            getWhere: vi.fn(),
        } as any;
        service = new GraphqlService(whereService as any);
    });

    it('should convert order array to OrderMap', () => {
        const order = [
            { field: 'title', direction: OrderByDirection.ASC },
            { field: 'id', direction: OrderByDirection.DESC },
        ];
        const orderMap = service.getOrder(order);
        expect(orderMap.get('title')).toBe(OrderByDirection.ASC);
        expect(orderMap.get('id')).toBe(OrderByDirection.DESC);
    });

    it('should swap order directions', () => {
        const orderMap = new Map([
            ['id', OrderByDirection.DESC],
            ['title', OrderByDirection.ASC],
        ]);
        const swapped = service.swapOrder(orderMap);
        expect(swapped.get('title')).toBe(OrderByDirection.DESC);
        expect(swapped.get('id')).toBe(OrderByDirection.ASC);
    });

    it('should get cursor value for boolean', () => {
        expect(service.getCursorValue(true)).toBe(1);
        expect(service.getCursorValue(false)).toBe(0);
        expect(service.getCursorValue('foo')).toBe('foo');
        expect(service.getCursorValue(42)).toBe(42);
    });

    it('should get cursor with primary key and ordered fields', () => {
        const entity = { title: 'Test', createdAt: '2023-01-01' };
        const orderBy = new Map([['title', OrderByDirection.ASC]]);

        const cursor = service.getCursor(entity as any, orderBy);

        expect(cursor).toEqual({
            id: '123',
            title: 'Test',
        });
    });

    it('should convert OrderMap to QueryOrderMap', () => {
        const orderBy = new Map([
            ['createdAt', OrderByDirection.DESC],
            ['title', OrderByDirection.ASC],
        ]);

        const queryOrder = service.getQueryOrderMap(orderBy);

        expect(queryOrder).toEqual({
            title: OrderByDirection.ASC,
            createdAt: OrderByDirection.DESC,
        });
    });

    it('should build cursor conditions as FilterQuery', () => {
        const cursor = { id: 1, title: 'abc' };
        const orderBy = new Map([
            ['id', OrderByDirection.ASC],
            ['title', OrderByDirection.ASC],
        ]);

        const conditions = service.getQueryConditions(cursor, orderBy, false);

        expect(conditions).toBeDefined();
        expect(conditions).toHaveProperty('$or');
    });

    it('should build inverted cursor conditions', () => {
        const cursor = { id: 1, title: 'abc' };
        const orderBy = new Map([
            ['id', OrderByDirection.ASC],
            ['title', OrderByDirection.ASC],
        ]);

        const conditions = service.getQueryConditions(cursor, orderBy, true);

        expect(conditions).toBeDefined();
        expect(conditions).toHaveProperty('$or');
    });

    it('should throw if findAndPaginate is called with missing methods', async () => {
        // Simulate a repository with missing methods
        const repo = {};
        await expect(service.findAndPaginate(repo as any, undefined, undefined, { first: 1 } as any)).rejects.toThrow();
    });

    it('should throw if findOne is called with missing methods', async () => {
        // Simulate a repository with missing methods
        const repo = {};
        await expect(service.findOne(repo as any, {}, {})).rejects.toThrow();
    });
});
