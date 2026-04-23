import {
    describe, expect, it, vi,
} from 'vitest';

import { RoomState } from '../../dungeon/dungeon.enums.js';
import { SceneType } from '../../session/session.enums.js';
import { EnterDungeonHandler } from './enter-dungeon.handler.js';
import { ExitDungeonHandler } from './exit-dungeon.handler.js';
import { MoveToRoomHandler } from './move-to-room.handler.js';

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
vi.mock('@nestjs/common', () => ({ Injectable: () => () => {} }));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

describe('dungeon navigation handlers', () => {
    it('EnterDungeonHandler sets active dungeon and DUNGEON scene type', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: null, sceneType: SceneType.EXPLORATION };
        const dungeon = { id: 5, campaign: { id: 10 } };
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce(session)
                .mockResolvedValueOnce(dungeon),
            flush: vi.fn(),
        };

        const result = await new EnterDungeonHandler(em as never).execute(1, 5);

        expect(result).toMatchObject({ success: true, data: { dungeonId: 5, sceneType: SceneType.DUNGEON } });
        expect(session.activeDungeon).toBe(dungeon);
    });

    it('MoveToRoomHandler returns ROOM_NOT_CONNECTED for disconnected rooms', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: { id: 7, encounterTable: null } };
        const room = { id: 4, dungeon: { id: 7 }, roomState: RoomState.UNEXPLORED };
        const currentRoom = { id: 3, dungeon: { id: 7 }, connectedLocationIds: [9] };
        const campaign = { id: 10, currentLocationId: 3 };
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce(session)
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(campaign)
                .mockResolvedValueOnce(currentRoom),
            flush: vi.fn(),
        };
        const dice = { roll: vi.fn().mockReturnValue({ success: true, total: 4 }) };

        const result = await new MoveToRoomHandler(em as never, dice as never).execute(1, 4);

        expect(result).toMatchObject({ success: false, errorCode: 'ROOM_NOT_CONNECTED' });
    });

    it('MoveToRoomHandler marks unexplored rooms explored and rolls wandering checks', async () => {
        const session = {
            id: 1,
            campaign: { id: 10 },
            activeDungeon: { id: 7, encounterTable: [{ weight: 1, monsters: [] }] },
        };
        const room = { id: 4, dungeon: { id: 7 }, roomState: RoomState.UNEXPLORED };
        const campaign = { id: 10, currentLocationId: null };
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce(session)
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(campaign),
            flush: vi.fn(),
        };
        const dice = { roll: vi.fn().mockReturnValue({ success: true, total: 1 }) };

        const result = await new MoveToRoomHandler(em as never, dice as never).execute(1, 4);

        expect(result).toMatchObject({
            success: true,
            data: { roomId: 4, roomState: RoomState.EXPLORED, wanderingMonsterTriggered: true },
        });
    });

    it('ExitDungeonHandler clears the active dungeon and returns to exploration', async () => {
        const session = { id: 1, activeDungeon: { id: 9 }, sceneType: SceneType.DUNGEON };
        const em = {
            findOne: vi.fn().mockResolvedValue(session),
            flush: vi.fn(),
        };

        const result = await new ExitDungeonHandler(em as never).execute(1);

        expect(result).toMatchObject({ success: true, data: { sceneType: SceneType.EXPLORATION } });
        expect(session.activeDungeon).toBeNull();
    });
});
