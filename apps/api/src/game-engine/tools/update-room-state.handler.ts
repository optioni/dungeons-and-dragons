import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { RoomState } from '../../dungeon/dungeon.enums.js';
import { DungeonService } from '../../dungeon/dungeon.service.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';

const ROOM_STATES = new Set<string>(Object.values(RoomState));

@Injectable()
export class UpdateRoomStateHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly dungeonService: DungeonService,
    ) {}

    async execute(sessionId: number, roomId: number, state: string): Promise<ToolResult> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['activeDungeon'] });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        if (!session.activeDungeon) {
            return { success: false, errorCode: 'NO_ACTIVE_DUNGEON', message: 'No active dungeon for this session' };
        }

        if (!ROOM_STATES.has(state)) {
            return { success: false, errorCode: 'INVALID_ROOM_STATE', message: `Invalid room state: ${state}` };
        }

        const room = await this.em.findOne(Location, { id: roomId }, { populate: ['dungeon'] });
        if (!room || room.dungeon?.id !== session.activeDungeon.id) {
            return { success: false, errorCode: 'ROOM_NOT_FOUND', message: `Room ${roomId} not found in active dungeon` };
        }

        const updatedRoom = await this.dungeonService.updateRoomState(roomId, state as RoomState);
        return { success: true, data: { roomId: updatedRoom.id, roomState: updatedRoom.roomState } };
    }
}
