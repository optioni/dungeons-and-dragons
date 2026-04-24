import {
    describe, expect, it, vi,
} from 'vitest';

import { ItemService } from './item.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Optional: () => () => {},
}));
vi.mock('@nestjs/event-emitter', () => ({
    EventEmitter2: class EventEmitter2 {
        emit() {}
    },
    InjectEventEmitter: () => () => {},
}));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeCharacter(overrides: Record<string, unknown> = {}) {
    return { id: 1, goldPieces: 100, conditions: [] as string[], ...overrides };
}

function makeItem(overrides: Record<string, unknown> = {}) {
    return { id: 10, name: 'Sword', mapId: null, ...overrides };
}

function makeCharacterItem(overrides: Record<string, unknown> = {}) {
    return {
        id: 5, character: { id: 1 }, item: { id: 10 }, quantity: 1, slot: null, ...overrides,
    };
}

function makeNpcItem(overrides: Record<string, unknown> = {}) {
    return {
        id: 20, npcId: 99, itemId: 10, name: 'Sword', quantity: 5, merchantPrice: 10, ...overrides,
    };
}

function makeEm(entities: {
    character?: unknown
    item?: unknown
    characterItem?: unknown
    npcItem?: unknown
    npcItems?: unknown[]
} = {}) {
    return {
        findOne: vi.fn().mockImplementation((entity: unknown) => {
            const name = String(entity);
            if (name.includes('Character') && !name.includes('Item')) {
                return Promise.resolve(entities.character ?? null);
            }

            if (name.includes('CharacterItem')) {
                return Promise.resolve(entities.characterItem ?? null);
            }

            if (name.includes('NpcItem')) {
                return Promise.resolve(entities.npcItem ?? null);
            }

            if (name.includes('Item')) {
                return Promise.resolve(entities.item ?? null);
            }

            return Promise.resolve(null);
        }),
        find: vi.fn().mockResolvedValue(entities.npcItems ?? []),
        create: vi.fn().mockImplementation((_error: unknown, data: unknown) => ({ ...data as object, id: 99 })),
        persist: vi.fn(),
        remove: vi.fn(),
        flush: vi.fn(),
        transactional: vi.fn().mockImplementation((callback: () => Promise<unknown>) => callback()),
        getEntityManager: vi.fn().mockReturnThis(),
    };
}

describe('ItemService', () => {
    describe('equipItem', () => {
        it('sets slot when no conflict exists', async () => {
            const charItem = makeCharacterItem({ slot: null, character: { id: 1 } });
            const em = makeEm({ characterItem: charItem });
            em.findOne.mockImplementation((_entity: unknown, query: Record<string, unknown>) => {
                // Direct id lookup returns charItem; conflict check (has 'character' key) returns null
                if ('character' in query) {
                    return Promise.resolve(null);
                }

                return Promise.resolve(charItem);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.equipItem(5, 'MAIN_HAND');
            expect(result.success).toBe(true);
            expect(charItem.slot).toBe('MAIN_HAND');
        });

        it('returns SLOT_OCCUPIED when another item is in that slot', async () => {
            const charItem = makeCharacterItem({ slot: null, character: { id: 1 } });
            const occupyingItem = makeCharacterItem({ id: 6, slot: 'MAIN_HAND', character: { id: 1 } });
            const em = makeEm({ characterItem: charItem });
            em.findOne.mockImplementation((_entity: unknown, query: Record<string, unknown>) => {
                if ('character' in query) {
                    return Promise.resolve(occupyingItem);
                }

                return Promise.resolve(charItem);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.equipItem(5, 'MAIN_HAND');
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('SLOT_OCCUPIED');
        });
    });

    describe('buyItem', () => {
        it('deducts gold and transfers item on success', async () => {
            const char = makeCharacter({ goldPieces: 50 });
            const npcItem = makeNpcItem({ quantity: 5, merchantPrice: 10 });
            const em = makeEm({ character: char, npcItem });
            em.findOne.mockImplementation((entity: unknown) => {
                const name = String(entity);
                if (name.includes('NpcItem')) {
                    return Promise.resolve(npcItem);
                }

                if (name.includes('Character') && !name.includes('Item')) {
                    return Promise.resolve(char);
                }

                if (name.includes('CharacterItem')) {
                    // no existing
                    return Promise.resolve(null);
                }

                return Promise.resolve(null);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.buyItem(1, 99, 10, 2);
            expect(result.success).toBe(true);
            // 50 - 2*10
            expect(char.goldPieces).toBe(30);
            // 5 - 2
            expect(npcItem.quantity).toBe(3);
        });

        it('returns INSUFFICIENT_GOLD when character cannot afford', async () => {
            const char = makeCharacter({ goldPieces: 5 });
            const npcItem = makeNpcItem({ quantity: 5, merchantPrice: 10 });
            const em = makeEm({ character: char, npcItem });
            em.findOne.mockImplementation((entity: unknown) => {
                if (String(entity).includes('NpcItem')) {
                    return Promise.resolve(npcItem);
                }

                return Promise.resolve(char);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.buyItem(1, 99, 10, 2);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('INSUFFICIENT_GOLD');
        });

        it('returns INSUFFICIENT_STOCK when NPC lacks quantity', async () => {
            const char = makeCharacter({ goldPieces: 100 });
            const npcItem = makeNpcItem({ quantity: 1, merchantPrice: 10 });
            const em = makeEm({ character: char, npcItem });
            em.findOne.mockImplementation((entity: unknown) => {
                if (String(entity).includes('NpcItem')) {
                    return Promise.resolve(npcItem);
                }

                return Promise.resolve(char);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.buyItem(1, 99, 10, 3);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('INSUFFICIENT_STOCK');
        });
    });

    describe('sellItem', () => {
        it('credits gold and removes CharacterItem when quantity reaches 0', async () => {
            const char = makeCharacter({ goldPieces: 20 });
            const charItem = makeCharacterItem({ quantity: 1, item: makeItem({ value: 50 }) });
            const em = makeEm({ character: char, characterItem: charItem, npcItem: null });
            em.findOne.mockImplementation((entity: unknown) => {
                if (String(entity).includes('CharacterItem')) {
                    return Promise.resolve(charItem);
                }

                if (String(entity).includes('NpcItem')) {
                    return Promise.resolve(null);
                }

                return Promise.resolve(char);
            });
            const service = new ItemService(em as never, null as never);
            const result = await service.sellItem(1, 99, 10, 1);
            expect(result.success).toBe(true);
            expect(char.goldPieces).toBeGreaterThan(20);
            expect(em.remove).toHaveBeenCalled();
        });
    });

    describe('StateChangedEvent emissions', () => {
        it('giveItem emits GIVE_ITEM event with itemId as entityId', async () => {
            const emitMock = vi.fn();
            const char = makeCharacter({ id: 1, campaign: { id: 10 } });
            const item = makeItem({ id: 10, mapId: null });
            const em = makeEm({ character: char, item, characterItem: null });
            em.findOne.mockImplementation((entity: unknown) => {
                const name = String(entity);
                if (name.includes('Item') && !name.includes('Character') && !name.includes('Npc')) {
                    return Promise.resolve(item);
                }

                if (name.includes('Character') && !name.includes('Item')) {
                    return Promise.resolve(char);
                }

                if (name.includes('CharacterItem')) {
                    return Promise.resolve(null);
                }

                return Promise.resolve(null);
            });
            const service = new ItemService(em as never, { emit: emitMock } as never);
            const result = await service.giveItem(1, 10, 1, 1, undefined);
            expect(result.success).toBe(true);
            expect(emitMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'GIVE_ITEM', entityId: '10' }),
            );
        });
    });
});
