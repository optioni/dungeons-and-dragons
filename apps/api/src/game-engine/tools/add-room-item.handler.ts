import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Item } from '../../character/entities/item.entity.js';
import { DungeonService } from '../../dungeon/dungeon.service.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';

@Injectable()
export class AddRoomItemHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly dungeonService: DungeonService,
    ) {}

    async execute(
        sessionId: number,
        input: { roomId: number; itemId: number; quantity?: number; containerName?: string | null },
    ): Promise<ToolResult> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['activeDungeon'] });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        if (!session.activeDungeon) {
            return { success: false, errorCode: 'NO_ACTIVE_DUNGEON', message: 'No active dungeon for this session' };
        }

        const room = await this.em.findOne(Location, { id: input.roomId }, { populate: ['dungeon'] });
        if (!room || room.dungeon?.id !== session.activeDungeon.id) {
            return { success: false, errorCode: 'ROOM_NOT_FOUND', message: `Room ${input.roomId} not found in active dungeon` };
        }

        const item = await this.em.findOne(Item, { id: input.itemId });
        if (!item) {
            return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `Item ${input.itemId} not found` };
        }

        const roomItem = await this.dungeonService.addRoomItem(
            input.roomId,
            input.itemId,
            input.quantity ?? 1,
            input.containerName ?? null,
        );

        return { success: true, data: { roomItemId: roomItem.id } };
    }
}
