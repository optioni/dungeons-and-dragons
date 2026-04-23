import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { DungeonService } from '../../dungeon/dungeon.service.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';

@Injectable()
export class SpawnEncounterHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly dungeonService: DungeonService,
    ) {}

    async execute(
        sessionId: number,
        input: { roomId?: number; dungeonId?: number; fromTable?: boolean },
    ): Promise<ToolResult> {
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

        if (input.roomId !== undefined) {
            const room = await this.em.findOne(Location, { id: input.roomId }, { populate: ['dungeon'] });
            if (!room || room.dungeon?.id !== session.activeDungeon.id) {
                return { success: false, errorCode: 'ROOM_NOT_FOUND', message: `Room ${input.roomId} not found in active dungeon` };
            }
        }

        if (input.dungeonId !== undefined && input.dungeonId !== session.activeDungeon.id) {
            return {
                success: false,
                errorCode: 'DUNGEON_NOT_FOUND',
                message: `Dungeon ${input.dungeonId} is not the active dungeon`,
            };
        }

        try {
            const result = await this.dungeonService.spawnEncounter({
                campaignId: session.campaign.id,
                roomId: input.roomId,
                dungeonId: input.dungeonId ?? session.activeDungeon.id,
                fromTable: input.fromTable,
            });

            return { success: true, data: result };
        } catch (error) {
            const errorCode = error instanceof Error ? error.message : 'ENCOUNTER_SPAWN_FAILED';
            return { success: false, errorCode, message: errorCode };
        }
    }
}
