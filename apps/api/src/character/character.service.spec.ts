/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class */
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { CharacterService } from './character.service';

vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToMany: () => () => {},
}));

vi.mock('@mikro-orm/core', () => ({
    type: {},
    Type: class {},
    Collection: class {},
    OptionalProps: Symbol('OptionalProps'),
}));

vi.mock('@mikro-orm/postgresql', () => ({
    BaseEntity: class {},
}));

vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    InputType: () => () => {},
    registerEnumType: () => {},
}));

vi.mock('@mikro-orm/nestjs', () => ({
    InjectRepository: () => () => {},
}));

vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    BadRequestException: class BadRequestException extends Error {},
    ConflictException: class ConflictException extends Error {},
    ForbiddenException: class ForbiddenException extends Error {},
    NotFoundException: class NotFoundException extends Error {},
}));

/** Creates a CharacterService instance with null repositories for pure method testing. */
function makeService(): CharacterService {
    return new CharacterService(null as never, null as never, null as never);
}

describe('CharacterService — pure methods', () => {
    let service: CharacterService;

    beforeEach(() => {
        service = makeService();
    });

    // Task 3.1: ability score validation
    describe('validateAbilityScores', () => {
        it('accepts the canonical standard array order', () => {
            expect(() => service.validateAbilityScores({
                STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8,
            })).not.toThrow();
        });

        it('accepts any permutation of the standard array', () => {
            expect(() => service.validateAbilityScores({
                STR: 8, DEX: 10, CON: 12, INT: 13, WIS: 14, CHA: 15,
            })).not.toThrow();
        });

        it('rejects values that are not a permutation of [15,14,13,12,10,8]', () => {
            expect(() => service.validateAbilityScores({
                STR: 18, DEX: 18, CON: 18, INT: 18, WIS: 18, CHA: 18,
            })).toThrow('must be a permutation of the standard array');
        });

        it('rejects point-buy style arrays even if values look reasonable', () => {
            expect(() => service.validateAbilityScores({
                STR: 15, DEX: 15, CON: 13, INT: 12, WIS: 10, CHA: 8,
            })).toThrow('must be a permutation of the standard array');
        });

        it('rejects arrays with correct sum but wrong individual values', () => {
            // Sum is 72 (same as standard) but values differ
            expect(() => service.validateAbilityScores({
                STR: 16, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 7,
            })).toThrow('must be a permutation of the standard array');
        });
    });

    // Task 3.3: initial HP calculation
    describe('calculateInitialHp', () => {
        it('returns hitDie + CON modifier for a positive modifier', () => {
            // CON 14 → modifier +2; Fighter hitDie 10 → 12
            expect(service.calculateInitialHp(10, 14)).toBe(12);
        });

        it('returns hitDie + CON modifier for zero modifier', () => {
            // CON 10 → modifier 0; Rogue hitDie 8 → 8
            expect(service.calculateInitialHp(8, 10)).toBe(8);
        });

        it('applies a negative CON modifier', () => {
            // CON 8 → modifier -1; Wizard hitDie 6 → 5
            expect(service.calculateInitialHp(6, 8)).toBe(5);
        });

        it('enforces minimum HP of 1 even with a large negative modifier', () => {
            // CON 1 → modifier -5; Sorcerer hitDie 6 → max(1, 6-5) = 1
            expect(service.calculateInitialHp(6, 1)).toBe(1);
        });
    });

    // Task 3.5: proficiency bonus computation
    describe('getProficiencyBonus', () => {
        it('returns 2 for levels 1–4', () => {
            expect(service.getProficiencyBonus(1)).toBe(2);
            expect(service.getProficiencyBonus(4)).toBe(2);
        });

        it('returns 3 for levels 5–8', () => {
            expect(service.getProficiencyBonus(5)).toBe(3);
            expect(service.getProficiencyBonus(8)).toBe(3);
        });

        it('returns 4 for levels 9–12', () => {
            expect(service.getProficiencyBonus(9)).toBe(4);
            expect(service.getProficiencyBonus(12)).toBe(4);
        });

        it('returns 5 for levels 13–16', () => {
            expect(service.getProficiencyBonus(13)).toBe(5);
            expect(service.getProficiencyBonus(16)).toBe(5);
        });

        it('returns 6 for levels 17–20', () => {
            expect(service.getProficiencyBonus(17)).toBe(6);
            expect(service.getProficiencyBonus(20)).toBe(6);
        });
    });

    // Task 5.1: slot-vacancy check
    describe('equipItem — slot vacancy', () => {
        it('throws ConflictException when the target slot is already occupied', async () => {
            const owner = { id: 1, campaign: { userId: 42 } };
            const targetItem = { id: 7, character: owner, item: {} };
            const existingItem = { id: 99, character: owner, item: {}, slot: 'MAIN_HAND' };

            const transactionEm = {
                begin: vi.fn(),
                rollback: vi.fn(),
                commit: vi.fn(),
                findOne: vi.fn()
                    // re-fetch inside transaction
                    .mockResolvedValueOnce(targetItem)
                    // slot already occupied
                    .mockResolvedValueOnce(existingItem),
                flush: vi.fn(),
            };

            const mockEm = {
                findOne: vi.fn().mockResolvedValueOnce(targetItem),
                fork: vi.fn().mockReturnValue(transactionEm),
            };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.equipItem(7, 'MAIN_HAND' as never, 42)).rejects.toThrow('MAIN_HAND');
        });

        it('throws NotFoundException when item does not belong to the user', async () => {
            const mockEm = {
                // not found
                findOne: vi.fn().mockResolvedValueOnce(null),
                fork: vi.fn(),
            };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.equipItem(7, 'MAIN_HAND' as never, 42)).rejects.toThrow('not found');
        });
    });

    // Task 5.3 — unequipItem ownership checks (#6 from review)
    describe('unequipItem — ownership check', () => {
        it('throws NotFoundException when the item does not exist', async () => {
            const forkedEm = {
                findOne: vi.fn().mockResolvedValueOnce(null),
                flush: vi.fn(),
            };
            const mockEm = { fork: vi.fn().mockReturnValue(forkedEm) };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.unequipItem(7, 42)).rejects.toThrow('not found');
        });

        it('throws NotFoundException when the item belongs to a different user', async () => {
            const foreignItem = { id: 7, character: { id: 1, campaign: { userId: 99 } }, item: {}, slot: 'HEAD' };
            const forkedEm = {
                findOne: vi.fn().mockResolvedValueOnce(foreignItem),
                flush: vi.fn(),
            };
            const mockEm = { fork: vi.fn().mockReturnValue(forkedEm) };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.unequipItem(7, 42)).rejects.toThrow('not found');
        });
    });

    // Task 5.4 — getInventory ownership checks (#6 from review)
    describe('getInventory — ownership check', () => {
        it('throws NotFoundException when the character does not exist', async () => {
            const mockEm = {
                findOne: vi.fn().mockResolvedValueOnce(null),
                find: vi.fn(),
            };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.getInventory(1, 42)).rejects.toThrow('not found');
        });

        it('throws NotFoundException when the character belongs to a different user', async () => {
            const foreignCharacter = { id: 1, campaign: { userId: 99 } };
            const mockEm = {
                findOne: vi.fn().mockResolvedValueOnce(foreignCharacter),
                find: vi.fn(),
            };

            const svc = new CharacterService(
                null as never,
                { getEntityManager: () => mockEm } as never,
                null as never,
            );

            await expect(svc.getInventory(1, 42)).rejects.toThrow('not found');
        });
    });
});
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class */
