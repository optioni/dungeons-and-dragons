import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { RoomState } from './dungeon.enums.js';
import { DungeonService } from './dungeon.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToMany: () => () => {},
    OneToOne: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({
    type: {},
    OptionalProps: Symbol(),
    Collection: class {},
    Type: class {},
}));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {}, EntityRepository: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Inject: () => () => {},
    ForbiddenException: class ForbiddenException extends Error {},
    NotFoundException: class NotFoundException extends Error {},
}));
vi.mock('@nestjs/cache-manager', () => ({ CACHE_MANAGER: Symbol('CACHE_MANAGER'), CacheModule: class {} }));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeRepo(overrides: Record<string, unknown> = {}) {
    return {
        findOne: vi.fn(),
        find: vi.fn(),
        createQueryBuilder: vi.fn(),
        ...overrides,
    };
}

describe('DungeonService', () => {
    let em: {
        create: ReturnType<typeof vi.fn>
        persist: ReturnType<typeof vi.fn>
        flush: ReturnType<typeof vi.fn>
        remove: ReturnType<typeof vi.fn>
    };

    beforeEach(() => {
        em = {
            create: vi.fn().mockImplementation((_entity: unknown, data: Record<string, unknown>) => ({ id: 1, ...data })),
            persist: vi.fn(),
            flush: vi.fn(),
            remove: vi.fn(),
        };
    });

    function makeService(overrides: {
        dungeonRepo?: ReturnType<typeof makeRepo>
        roomEncounterRepo?: ReturnType<typeof makeRepo>
        roomItemRepo?: ReturnType<typeof makeRepo>
        locationRepo?: ReturnType<typeof makeRepo>
        itemRepo?: ReturnType<typeof makeRepo>
        sessionRepo?: ReturnType<typeof makeRepo>
        campaignRepo?: ReturnType<typeof makeRepo>
        srdMonsterRepo?: ReturnType<typeof makeRepo>
        npcRepo?: ReturnType<typeof makeRepo>
    } = {}) {
        return new DungeonService(
            em as never,
            { get: vi.fn(), set: vi.fn() } as never,
            (overrides.dungeonRepo ?? makeRepo()) as never,
            (overrides.roomEncounterRepo ?? makeRepo()) as never,
            (overrides.roomItemRepo ?? makeRepo()) as never,
            (overrides.locationRepo ?? makeRepo()) as never,
            (overrides.itemRepo ?? makeRepo()) as never,
            (overrides.sessionRepo ?? makeRepo()) as never,
            (overrides.campaignRepo ?? makeRepo()) as never,
            (overrides.srdMonsterRepo ?? makeRepo()) as never,
            (overrides.npcRepo ?? makeRepo()) as never,
        );
    }

    it('createDungeon persists a dungeon for an owned campaign', async () => {
        const campaign = { id: 7, userId: 2 };
        const campaignRepo = makeRepo({ findOne: vi.fn().mockResolvedValue(campaign) });
        const service = makeService({ campaignRepo });

        const result = await service.createDungeon(7, 2, {
            name: 'Black Fane',
            description: 'A damp crypt beneath the moor.',
            totalFloors: 2,
        });

        expect(campaignRepo.findOne).toHaveBeenCalledWith({ id: 7, userId: 2 });
        expect(em.persist).toHaveBeenCalled();
        expect(result.name).toBe('Black Fane');
        expect(result.totalFloors).toBe(2);
    });

    it('addRoomItem persists a room item row', async () => {
        const room = { id: 10 };
        const item = { id: 20 };
        const service = makeService({
            locationRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(room) }),
            itemRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(item) }),
        });

        const result = await service.addRoomItem(10, 20, 3, 'Iron chest');

        expect(em.persist).toHaveBeenCalled();
        expect(result.quantity).toBe(3);
        expect(result.containerName).toBe('Iron chest');
    });

    it('removeRoomItem decrements quantity when stock remains', async () => {
        const roomItem = { id: 1, quantity: 3 };
        const roomItemRepo = makeRepo({ findOne: vi.fn().mockResolvedValue(roomItem) });
        const service = makeService({ roomItemRepo });

        const removed = await service.removeRoomItem(1, 1);

        expect(removed).toBe(true);
        expect(roomItem.quantity).toBe(2);
        expect(em.remove).not.toHaveBeenCalled();
    });

    it('updateRoomState persists the requested state', async () => {
        const room = { id: 33, roomState: RoomState.UNEXPLORED };
        const service = makeService({
            locationRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(room) }),
        });

        const result = await service.updateRoomState(33, RoomState.CLEARED);

        expect(result.roomState).toBe(RoomState.CLEARED);
        expect(em.flush).toHaveBeenCalled();
    });
});
