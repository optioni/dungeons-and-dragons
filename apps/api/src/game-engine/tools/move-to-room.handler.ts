import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { RoomState } from '../../dungeon/dungeon.enums.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';
import { DiceService } from '../dice.service.js';

@Injectable()
export class MoveToRoomHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly dice: DiceService,
    ) {}

    async execute(sessionId: number, roomId: number): Promise<ToolResult> {
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

        const campaign = await this.em.findOne(Campaign, { id: session.campaign.id });
        if (!campaign) {
            return {
                success: false,
                errorCode: 'CAMPAIGN_NOT_FOUND',
                message: `Campaign ${session.campaign.id} not found`,
            };
        }

        if (campaign.currentLocationId !== null && campaign.currentLocationId !== roomId) {
            const currentRoom = await this.em.findOne(Location, { id: campaign.currentLocationId }, { populate: ['dungeon'] });
            if (currentRoom?.dungeon?.id === session.activeDungeon.id && !currentRoom.connectedLocationIds.includes(roomId)) {
                return {
                    success: false,
                    errorCode: 'ROOM_NOT_CONNECTED',
                    message: `Room ${roomId} is not connected to current room ${currentRoom.id}`,
                };
            }
        }

        campaign.currentLocationId = roomId;
        if (room.roomState === null || room.roomState === RoomState.UNEXPLORED) {
            room.roomState = RoomState.EXPLORED;
        }

        let wanderingMonsterTriggered = false;
        if (session.activeDungeon.encounterTable !== null) {
            const roll = this.dice.roll('1d6');
            wanderingMonsterTriggered = roll.success && roll.total === 1;
        }

        await this.em.flush();

        return {
            success: true,
            data: {
                roomId,
                roomState: room.roomState,
                wanderingMonsterTriggered,
            },
        };
    }
}
