import { registerEnumType } from '@nestjs/graphql';

export enum RoomState {
    UNEXPLORED = 'UNEXPLORED',
    EXPLORED = 'EXPLORED',
    CLEARED = 'CLEARED',
    LOCKED = 'LOCKED',
    TRAPPED = 'TRAPPED',
}

registerEnumType(RoomState, { name: 'RoomState' });
