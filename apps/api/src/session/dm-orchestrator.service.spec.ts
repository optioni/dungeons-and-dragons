// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { DmOrchestrator } from './dm-orchestrator.service';
import { DmStreamChunkType } from './dto/dm-stream-chunk.dto';
import { GameSession } from './entities/game-session.entity';
import { EventType, SceneType } from './session.enums';

function makeSession(overrides = {}): GameSession {
    return Object.assign(new GameSession(), {
        id: 1,
        sceneType: SceneType.EXPLORATION,
        campaign: { id: 10, userId: 1 },
        ...overrides,
    });
}

function makeStreamIterable(events: unknown[]): AsyncIterable<unknown> {
    return {
        async* [Symbol.asyncIterator]() {
            for (const event of events) {
                yield event;
            }
        },
    };
}

function makeMockAnthropicStream(content: unknown[], stopReason = 'end_turn') {
    const streamEvents: unknown[] = [];
    // No text deltas for simplicity in this test
    return {
        [Symbol.asyncIterator]: makeStreamIterable(streamEvents)[Symbol.asyncIterator],
        /* eslint-disable @typescript-eslint/naming-convention */
        finalMessage: vi.fn().mockResolvedValue({
            content,
            stop_reason: stopReason,
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
    };
}

describe('DmOrchestrator', () => {
    const sessionId = 1;
    const playerInput = 'I look around';

    let sessionService: Record<string, ReturnType<typeof vi.fn>>;
    let contextLoader: Record<string, ReturnType<typeof vi.fn>>;
    let toolRegistry: Record<string, ReturnType<typeof vi.fn>>;
    let streamPublisher: Record<string, ReturnType<typeof vi.fn>>;
    let mockAnthropicMessages: Record<string, ReturnType<typeof vi.fn>>;
    let orchestrator: DmOrchestrator;

    beforeEach(() => {
        const session = makeSession();

        sessionService = {
            appendEvent: vi.fn().mockResolvedValue({}),
            findSessionWithCampaign: vi.fn().mockResolvedValue(session),
        };

        contextLoader = {
            loadBaseBlock: vi.fn().mockReturnValue('System prompt'),
            loadCampaignBlock: vi.fn().mockResolvedValue('Campaign block'),
            loadWorldBlock: vi.fn().mockResolvedValue('World block'),
            loadHistoryBlock: vi.fn().mockResolvedValue([
                { role: 'user', content: playerInput },
            ]),
        };

        toolRegistry = {
            dispatch: vi.fn().mockResolvedValue({ success: true }),
        };

        streamPublisher = {
            publish: vi.fn(),
        };

        const mockStream = makeMockAnthropicStream([{ type: 'text', text: 'The room is quiet.' }]);
        mockAnthropicMessages = {
            stream: vi.fn().mockReturnValue(mockStream),
        };

        orchestrator = new DmOrchestrator(
            sessionService as never,
            contextLoader as never,
            toolRegistry as never,
            streamPublisher as never,
            {
                getOrThrow: vi.fn().mockImplementation((key: string) => (key === 'ANTHROPIC_API_KEY' ? 'test-key' : 'claude-sonnet-4-6')),
            } as never,
        );

        // Inject mock Anthropic client
        (orchestrator as unknown as Record<string, unknown>)['anthropic'] = {
            messages: mockAnthropicMessages,
        };
    });

    it('persists PLAYER_INPUT event before invoking Claude', async () => {
        await orchestrator.runTurn(sessionId, playerInput);

        const calls = sessionService.appendEvent.mock.calls;
        const firstCall = calls[0];
        expect(firstCall[1]).toBe(EventType.PLAYER_INPUT);
        expect(firstCall[2]).toEqual({ text: playerInput });
    });

    it('calls ToolRegistry.dispatch when model returns tool_use block', async () => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const toolUseBlock = {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'set_scene_type',
            input: { scene_type: 'COMBAT' },
        };

        const mockStream = {
            async* [Symbol.asyncIterator]() {},
            finalMessage: vi.fn().mockResolvedValueOnce({
                content: [toolUseBlock],
                stop_reason: 'tool_use',
            }).mockResolvedValueOnce({
                content: [],
                stop_reason: 'end_turn',
            }),
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        mockAnthropicMessages.stream.mockReturnValue(mockStream);

        await orchestrator.runTurn(sessionId, playerInput);

        /* eslint-disable @typescript-eslint/naming-convention */
        expect(toolRegistry.dispatch).toHaveBeenCalledWith(sessionId, 'set_scene_type', { scene_type: 'COMBAT' });
        /* eslint-enable @typescript-eslint/naming-convention */
    });

    it('persists TOOL_CALL event after dispatching a tool', async () => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const toolUseBlock = {
            type: 'tool_use',
            id: 'toolu_abc',
            name: 'set_scene_type',
            input: { scene_type: 'COMBAT' },
        };

        const mockStream = {
            async* [Symbol.asyncIterator]() {},
            finalMessage: vi.fn().mockResolvedValueOnce({
                content: [toolUseBlock],
                stop_reason: 'tool_use',
            }).mockResolvedValueOnce({
                content: [],
                stop_reason: 'end_turn',
            }),
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        mockAnthropicMessages.stream.mockReturnValue(mockStream);

        await orchestrator.runTurn(sessionId, playerInput);

        const toolCallEvents = sessionService.appendEvent.mock.calls.filter(
            (callArgs: unknown[]) => callArgs[1] === EventType.TOOL_CALL,
        );
        expect(toolCallEvents).toHaveLength(1);
        expect(toolCallEvents[0][2]).toMatchObject({
            toolUseId: 'toolu_abc',
            toolName: 'set_scene_type',
        });
    });

    it('persists DM_NARRATIVE event on completion', async () => {
        /* eslint-disable @typescript-eslint/naming-convention */
        const mockStream = {
            async* [Symbol.asyncIterator]() {
                yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'You see a door.' } };
            },
            finalMessage: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'You see a door.' }],
                stop_reason: 'end_turn',
            }),
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        mockAnthropicMessages.stream.mockReturnValue(mockStream);

        await orchestrator.runTurn(sessionId, playerInput);

        const narrativeEvents = sessionService.appendEvent.mock.calls.filter(
            (callArgs: unknown[]) => callArgs[1] === EventType.DM_NARRATIVE,
        );
        expect(narrativeEvents).toHaveLength(1);
        expect(narrativeEvents[0][2]).toMatchObject({ narrative: 'You see a door.' });
    });

    it('emits DONE chunk after the turn completes', async () => {
        await orchestrator.runTurn(sessionId, playerInput);

        const doneChunks = (streamPublisher.publish as ReturnType<typeof vi.fn>).mock.calls
            .filter((callArgs: unknown[]) => (callArgs[1] as { type: string }).type === DmStreamChunkType.DONE);
        expect(doneChunks.length).toBeGreaterThan(0);
    });
});
