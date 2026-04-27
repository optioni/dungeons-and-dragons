import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Character } from '../../character/entities/character.entity.js';
import { RoomItem } from '../../dungeon/entities/room-item.entity.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { QuestService } from '../../quest/quest.service.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';
import { ItemService } from '../item.service.js';

@Injectable()
export class LootRoomHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly itemService: ItemService,
        private readonly questService: QuestService,
    ) {}

    async execute(sessionId: number, roomId: number, itemId: number, quantity: number): Promise<ToolResult> {
        const session = await this.em.findOne(
            GameSession,
            { id: sessionId },
            { populate: ['campaign', 'activeDungeon'] },
        );
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        if (!session.activeDungeon) {
            return { success: false, errorCode: 'NO_ACTIVE_DUNGEON', message: 'No active dungeon for this session' };
        }

        const room = await this.em.findOne(Location, { id: roomId }, { populate: ['dungeon'] });
        if (!room || room.dungeon?.id !== session.activeDungeon.id) {
            return { success: false, errorCode: 'ROOM_NOT_FOUND', message: `Room ${roomId} not found in active dungeon` };
        }

        const roomItem = await this.em.findOne(RoomItem, { room: roomId, item: itemId }, { populate: ['item'] });
        if (!roomItem) {
            return { success: false, errorCode: 'ITEM_NOT_IN_ROOM', message: `Item ${itemId} not found in room ${roomId}` };
        }

        if (roomItem.quantity < quantity) {
            return {
                success: false,
                errorCode: 'INSUFFICIENT_QUANTITY',
                message: `Room only contains ${roomItem.quantity} of item ${itemId}`,
            };
        }

        const character = await this.em.findOne(Character, { campaign: { id: session.campaign.id } } as never);
        const characterId = (character as { id?: number } | null)?.id;
        if (!characterId) {
            return {
                success: false,
                errorCode: 'CHARACTER_NOT_FOUND',
                message: `Character for campaign ${session.campaign.id} not found`,
            };
        }

        const giveResult = await this.itemService.giveItem(sessionId, itemId, quantity, characterId);
        if (!giveResult.success) {
            return giveResult;
        }

        roomItem.quantity -= quantity;
        if (roomItem.quantity <= 0) {
            this.em.remove(roomItem);
        }

        await this.em.flush();

        const checkerResult = await this.questService.runAutoChecker(session.campaign.id);
        return {
            success: true,
            data: { roomId, itemId, itemName: roomItem.item.name, quantity },
            ...(checkerResult.questCompleted ? { questCompleted: checkerResult.questCompleted } : {}),
        };
    }
}
