import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Dungeon } from '../../dungeon/entities/dungeon.entity.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { SceneType } from '../../session/session.enums.js';

@Injectable()
export class EnterDungeonHandler {
    constructor(private readonly em: EntityManager) {}

    async execute(sessionId: number, dungeonId: number): Promise<ToolResult> {
        const session = await this.em.findOne(
            GameSession,
            { id: sessionId },
            { populate: ['campaign', 'activeDungeon'] },
        );
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        if (session.activeDungeon) {
            return {
                success: false,
                errorCode: 'DUNGEON_ALREADY_ACTIVE',
                message: `Session ${sessionId} already has an active dungeon`,
            };
        }

        const dungeon = await this.em.findOne(Dungeon, { id: dungeonId, campaign: session.campaign.id });
        if (!dungeon) {
            return {
                success: false,
                errorCode: 'DUNGEON_NOT_FOUND',
                message: `Dungeon ${dungeonId} not found for this campaign`,
            };
        }

        session.activeDungeon = dungeon;
        session.sceneType = SceneType.DUNGEON;
        await this.em.flush();

        return { success: true, data: { dungeonId, sceneType: SceneType.DUNGEON } };
    }
}
