import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { DungeonService } from '../../dungeon/dungeon.service.js';
import { SpawnEncounterHandler } from './spawn-encounter.handler.js';

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
    return { findOne: vi.fn(), find: vi.fn(), createQueryBuilder: vi.fn(), ...overrides };
}

describe('SpawnEncounterHandler', () => {
    let em: {
        findOne: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
        persist: ReturnType<typeof vi.fn>
        flush: ReturnType<typeof vi.fn>
        remove: ReturnType<typeof vi.fn>
    };

    beforeEach(() => {
        let npcId = 1;
        em = {
            findOne: vi.fn(),
            create: vi.fn().mockImplementation(
                (_entity: unknown, data: Record<string, unknown>) => ({ id: npcId++, ...data }),
            ),
            persist: vi.fn(),
            flush: vi.fn(),
            remove: vi.fn(),
        };
    });

    function makeDungeonService(overrides: {
        roomEncounterRepo?: ReturnType<typeof makeRepo>
        locationRepo?: ReturnType<typeof makeRepo>
        dungeonRepo?: ReturnType<typeof makeRepo>
        srdMonsterRepo?: ReturnType<typeof makeRepo>
    } = {}) {
        return new DungeonService(
            em as never,
            { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as never,
            (overrides.dungeonRepo ?? makeRepo()) as never,
            (overrides.roomEncounterRepo ?? makeRepo()) as never,
            makeRepo() as never,
            (overrides.locationRepo ?? makeRepo()) as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            (overrides.srdMonsterRepo ?? makeRepo()) as never,
            makeRepo() as never,
        );
    }

    it('spawns keyed encounter NPCs with numeric suffixes from SRD data', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: { id: 7 } };
        const room = { id: 4, dungeon: { id: 7 } };
        const encounter = { room, cleared: false, monsters: [{ srdIndex: 'goblin', name: 'Goblin', count: 2 }] };
        const srdMonster = { index: 'goblin', hitPoints: 7 };

        em.findOne
            .mockResolvedValueOnce(session)
            .mockResolvedValueOnce(room);

        const dungeonService = makeDungeonService({
            locationRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(room) }),
            roomEncounterRepo: makeRepo({
                findOne: vi.fn()
                    .mockResolvedValueOnce(encounter)
                    .mockResolvedValueOnce(null),
            }),
            srdMonsterRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(srdMonster) }),
        });

        const result = await new SpawnEncounterHandler(em as never, dungeonService).execute(1, {
            roomId: 4,
        });

        expect(result).toMatchObject({ success: true, data: { npcIds: [1, 2], source: 'ROOM' } });
        expect(em.create).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({ name: 'Goblin 1', hp: 7 }),
        );
        expect(em.create).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({ name: 'Goblin 2', hp: 7 }),
        );
    });

    it('spawns wandering encounters from the dungeon table', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: { id: 7 } };
        const dungeon = { id: 7, encounterTable: [{ weight: 1, monsters: [{ name: 'Bat', count: 1, hp: 2 }] }] };

        em.findOne.mockResolvedValueOnce(session);

        const dungeonService = makeDungeonService({
            dungeonRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(dungeon) }),
        });

        const result = await new SpawnEncounterHandler(em as never, dungeonService).execute(1, {
            dungeonId: 7,
            fromTable: true,
        });

        expect(result).toMatchObject({ success: true, data: { npcIds: [1], source: 'WANDERING' } });
    });

    it('returns MONSTER_NOT_FOUND when keyed encounter references a missing SRD monster', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: { id: 7 } };
        const room = { id: 4, dungeon: { id: 7 } };
        const encounter = { room, cleared: false, monsters: [{ srdIndex: 'missing', name: 'Ghost', count: 1 }] };

        em.findOne
            .mockResolvedValueOnce(session)
            .mockResolvedValueOnce(room);

        const dungeonService = makeDungeonService({
            locationRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(room) }),
            roomEncounterRepo: makeRepo({
                findOne: vi.fn()
                    .mockResolvedValueOnce(encounter)
                    .mockResolvedValueOnce(null),
            }),
            srdMonsterRepo: makeRepo({ findOne: vi.fn().mockResolvedValue(null) }),
        });

        const result = await new SpawnEncounterHandler(em as never, dungeonService).execute(1, { roomId: 4 });

        expect(result).toMatchObject({ success: false, errorCode: 'MONSTER_NOT_FOUND' });
    });
});
