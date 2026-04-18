// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { SceneType } from '../session/session.enums';
import { DmStreamChunkType } from '../session/dto/dm-stream-chunk.dto';
import { SetSceneTypeHandler } from './tools/set-scene-type.handler';
import { ToolRegistry } from './tool-registry.service';

function makeMockSessionService(): Record<string, ReturnType<typeof vi.fn>> {
    return {
        updateSceneType: vi.fn().mockResolvedValue({}),
    };
}

function makeMockStreamPublisher(): Record<string, ReturnType<typeof vi.fn>> {
    return {
        publish: vi.fn(),
    };
}

describe('ToolRegistry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
        registry = new ToolRegistry();
    });

    it('dispatches to a registered handler', async () => {
        const handler = {
            toolName: 'my_tool',
            execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
        };
        registry.register(handler);

        const result = await registry.dispatch(1, 'my_tool', {});
        expect(handler.execute).toHaveBeenCalledWith(1, {});
        expect(result).toEqual({ success: true, data: 'ok' });
    });

    it('returns structured error for unknown tool', async () => {
        const result = await registry.dispatch(1, 'nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('UNKNOWN_TOOL');
    });

    it('returns structured error when handler throws', async () => {
        const handler = {
            toolName: 'throws_tool',
            execute: vi.fn().mockRejectedValue(new Error('boom')),
        };
        registry.register(handler);

        const result = await registry.dispatch(1, 'throws_tool', {});
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('TOOL_ERROR');
        expect(result.message).toBe('boom');
    });
});

describe('SetSceneTypeHandler', () => {
    const sessionId = 1;
    let sessionService: ReturnType<typeof makeMockSessionService>;
    let streamPublisher: ReturnType<typeof makeMockStreamPublisher>;
    let registry: ToolRegistry;
    let handler: SetSceneTypeHandler;

    beforeEach(() => {
        sessionService = makeMockSessionService();
        streamPublisher = makeMockStreamPublisher();
        registry = new ToolRegistry();
        handler = new SetSceneTypeHandler(sessionService as never, streamPublisher as never, registry);
    });

    it('registers itself in the ToolRegistry on init', () => {
        handler.onModuleInit();
        expect(registry['handlers'].has('set_scene_type')).toBe(true);
    });

    it('updates sceneType and emits STATUS chunk for valid scene', async () => {
        const result = await handler.execute(sessionId, { scene_type: SceneType.COMBAT });

        expect(sessionService.updateSceneType).toHaveBeenCalledWith(sessionId, SceneType.COMBAT);
        expect(streamPublisher.publish).toHaveBeenCalledWith(sessionId, expect.objectContaining({
            type: DmStreamChunkType.STATUS,
            sceneType: SceneType.COMBAT,
        }));
        expect(result.success).toBe(true);
    });

    it('returns structured error for invalid scene type', async () => {
        const result = await handler.execute(sessionId, { scene_type: 'FLYING' });

        expect(sessionService.updateSceneType).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INVALID_SCENE_TYPE');
    });

    it('returns structured error when session does not exist', async () => {
        sessionService.updateSceneType.mockRejectedValueOnce(new Error('Session not found'));

        const result = await handler.execute(sessionId, { scene_type: SceneType.SOCIAL });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('SESSION_NOT_FOUND');
    });
});
