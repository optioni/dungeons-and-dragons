import { Injectable, OnModuleInit } from '@nestjs/common';

import { DmStreamChunkType } from '../../session/dto/dm-stream-chunk.dto.js';
import { SceneType } from '../../session/session.enums.js';
import { SessionService } from '../../session/session.service.js';
import { StreamPublisher } from '../../session/stream-publisher.service.js';
import { type ToolHandler, type ToolResult } from '../tool-registry.js';
import { ToolRegistry } from '../tool-registry.service.js';

const VALID_SCENE_TYPES = new Set<string>(Object.values(SceneType));

/**
 * Handles `set_scene_type` tool calls from the DM. Validates the requested scene,
 * persists it on the active GameSession, and emits a STATUS stream chunk so the
 * web UI can react immediately.
 */
@Injectable()
export class SetSceneTypeHandler implements OnModuleInit, ToolHandler {
    readonly toolName = 'set_scene_type';

    constructor(
        private readonly sessionService: SessionService,
        private readonly streamPublisher: StreamPublisher,
        private readonly toolRegistry: ToolRegistry,
    ) {}

    onModuleInit(): void {
        this.toolRegistry.register(this);
    }

    async execute(sessionId: number, input: Record<string, unknown>): Promise<ToolResult> {
        const { scene_type: sceneTypeRaw } = input;

        if (typeof sceneTypeRaw !== 'string' || !VALID_SCENE_TYPES.has(sceneTypeRaw)) {
            return {
                success: false,
                errorCode: 'INVALID_SCENE_TYPE',
                message: `Invalid scene type: "${String(sceneTypeRaw)}". Valid values: ${[...VALID_SCENE_TYPES].join(', ')}`,
            };
        }

        const sceneType = sceneTypeRaw as SceneType;

        try {
            await this.sessionService.updateSceneType(sessionId, sceneType);
        } catch {
            return {
                success: false,
                errorCode: 'SESSION_NOT_FOUND',
                message: `Session ${sessionId} not found`,
            };
        }

        this.streamPublisher.publish(sessionId, {
            type: DmStreamChunkType.STATUS,
            status: `Scene changed to ${sceneType}`,
            sceneType,
        });

        return { success: true, data: { sceneType } };
    }
}
