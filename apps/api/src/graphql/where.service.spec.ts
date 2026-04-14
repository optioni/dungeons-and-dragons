/* eslint-disable @typescript-eslint/naming-convention */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WhereService } from './where.service';

describe('WhereService', () => {
    let service: WhereService;
    beforeEach(() => {
        service = new WhereService();
    });

    it('should apply simple equality filter', () => {
        const result = service.getWhere({ foo: 'bar' });
        expect(result).toEqual({ foo: { $eq: 'bar' } });
    });

    it('should apply operator filter', () => {
        const result = service.getWhere({ foo_gt: 5 });
        expect(result).toEqual({ foo: { $gt: 5 } });
    });

    it('should apply in operator as array', () => {
        const result = service.getWhere({ foo_in: [1, 2, 3] });
        expect(result).toEqual({ foo: { $in: [1, 2, 3] } });
    });

    it('should apply like operator with wildcards', () => {
        const result = service.getWhere({ foo_lk: 'bar' });
        expect(result).toEqual({ foo: { $ilike: '%bar%' } });
    });

    it('should handle AND/OR nested conditions', () => {
        const result = service.getWhere({
            AND: [{ foo: 1 }, { bar: 2 }],
            OR: [{ baz: 3 }, { qux: 4 }],
        });
        expect(result).toBeDefined();
        // Should contain $and wrapper with the AND conditions and the $or group
        expect(result).toHaveProperty('$and');
    });

    it('should wrap OR conditions in $or', () => {
        const result = service.getWhere({ OR: [{ foo: 1 }, { foo: 2 }] });
        expect(result).toEqual({ $or: [{ foo: { $eq: 1 } }, { foo: { $eq: 2 } }] });
    });

    it('should use resolver if provided', () => {
        const resolver = vi.fn().mockReturnValue({ custom: true });
        const result = service.getWhere({ foo: 'bar' }, { foo: resolver });
        expect(resolver).toHaveBeenCalledWith('=', 'bar');
        expect(result).toEqual({ custom: true });
    });

    it('should return undefined for empty where', () => {
        expect(service.getWhere({})).toBeUndefined();
        expect(service.getWhere(undefined)).toBeUndefined();
    });

    it('should return undefined for missing where', () => {
        expect(service.getWhere()).toBeUndefined();
    });

    it('should throw for unknown operator', () => {
        expect(() => service.getWhere({ foo_xyz: 'bar' })).toThrow('Operator not found');
    });

    it('should combine multiple conditions with $and', () => {
        const result = service.getWhere({ foo: 'bar', baz_gt: 5 });
        expect(result).toEqual({ $and: [{ foo: { $eq: 'bar' } }, { baz: { $gt: 5 } }] });
    });
});
