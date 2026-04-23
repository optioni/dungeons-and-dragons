import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { type ToolResult } from '../../llm/tool-registry.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { SceneType } from '../../session/session.enums.js';

@Injectable()
export class ExitDungeonHandler {
    constructor(private readonly em: EntityManager) {}

    async execute(sessionId: number): Promise<ToolResult> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['activeDungeon'] });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        if (!session.activeDungeon) {
            return { success: false, errorCode: 'NO_ACTIVE_DUNGEON', message: 'No active dungeon for this session' };
        }

        session.activeDungeon = null;
        session.sceneType = SceneType.EXPLORATION;
        await this.em.flush();

        return { success: true, data: { sceneType: SceneType.EXPLORATION } };
    }
}
