import {
    describe, expect, it, vi,
} from 'vitest';

import { RoomState } from '../../dungeon/dungeon.enums.js';
import { AddRoomItemHandler } from './add-room-item.handler.js';
import { LootRoomHandler } from './loot-room.handler.js';
import { UpdateRoomStateHandler } from './update-room-state.handler.js';

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
vi.mock('@nestjs/common', () => ({ Injectable: () => () => {}, Inject: () => () => {} }));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

describe('dungeon room handlers', () => {
    it('UpdateRoomStateHandler rejects invalid states', async () => {
        const em = { findOne: vi.fn().mockResolvedValue({ id: 1, activeDungeon: { id: 7 } }) };
        const handler = new UpdateRoomStateHandler(em as never, { updateRoomState: vi.fn() } as never);

        const result = await handler.execute(1, 4, 'BROKEN');

        expect(result).toMatchObject({ success: false, errorCode: 'INVALID_ROOM_STATE' });
    });

    it('AddRoomItemHandler creates a room item in the active dungeon', async () => {
        const session = { id: 1, activeDungeon: { id: 7 } };
        const room = { id: 4, dungeon: { id: 7 } };
        const item = { id: 9 };
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce(session)
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(item),
        };
        const dungeonService = { addRoomItem: vi.fn().mockResolvedValue({ id: 11 }) };

        const result = await new AddRoomItemHandler(em as never, dungeonService as never).execute(1, {
            roomId: 4,
            itemId: 9,
            quantity: 2,
            containerName: 'Stone coffer',
        });

        expect(result).toMatchObject({ success: true, data: { roomItemId: 11 } });
    });

    it('LootRoomHandler transfers items and runs the quest auto-checker', async () => {
        const session = { id: 1, campaign: { id: 10 }, activeDungeon: { id: 7 } };
        const room = { id: 4, dungeon: { id: 7 } };
        const roomItem = { room, item: { id: 9 }, quantity: 2 };
        const character = { id: 3 };
        const em = {
            findOne: vi.fn()
                .mockResolvedValueOnce(session)
                .mockResolvedValueOnce(room)
                .mockResolvedValueOnce(roomItem)
                .mockResolvedValueOnce(character),
            flush: vi.fn(),
            remove: vi.fn(),
        };
        const itemService = { giveItem: vi.fn().mockResolvedValue({ success: true, data: {} }) };
        const questService = { runAutoChecker: vi.fn().mockResolvedValue({ questCompleted: null }) };

        const result = await new LootRoomHandler(em as never, itemService as never, questService as never)
            .execute(1, 4, 9, 2);

        expect(result).toMatchObject({ success: true, data: { roomId: 4, itemId: 9, quantity: 2 } });
        expect(itemService.giveItem).toHaveBeenCalledWith(1, 9, 2, 3);
        expect(em.remove).toHaveBeenCalledWith(roomItem);
        expect(questService.runAutoChecker).toHaveBeenCalledWith(10);
    });
});
