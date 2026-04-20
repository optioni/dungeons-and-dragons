import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type EnvironmentConfig } from '../config/environment.validation.js';
import { ContextLoader } from '../llm/context-loader.service.js';
import { ToolRegistry } from '../llm/tool-registry.service.js';
import { DmStreamChunkType } from './dto/dm-stream-chunk.dto.js';
import { EventType } from './session.enums.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
/** Tool definitions exposed to the DM model. Extend as GameEngineModule lands. */
const DM_TOOLS: Anthropic.Tool[] = [
    {
        name: 'set_scene_type',
        description: 'Changes the active scene type for the current session, affecting prompt module and UI mode.',
        input_schema: {
            type: 'object' as const,
            properties: {
                scene_type: {
                    type: 'string',
                    enum: ['EXPLORATION', 'COMBAT', 'SOCIAL', 'SETTLEMENT', 'REST'],
                    description: 'The new scene type to activate',
                },
            },
            required: ['scene_type'],
        },
    },
];
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Orchestrates a single DM turn: persists player input, assembles prompt with
 * cache-control breakpoints, streams from Claude, dispatches tool calls through
 * ToolRegistry, accumulates narrative, and persists the final DM_NARRATIVE event.
 *
 * Finalization runs in a `finally` block so events are persisted even on SSE disconnect.
 */
@Injectable()
export class DmOrchestrator {
    private readonly logger = new Logger(DmOrchestrator.name);

    private readonly anthropic: Anthropic;

    private readonly dmModel: string;

    constructor(
        private readonly sessionService: SessionService,
        private readonly contextLoader: ContextLoader,
        private readonly toolRegistry: ToolRegistry,
        private readonly streamPublisher: StreamPublisher,
        private readonly configService: ConfigService<EnvironmentConfig>,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
        });
        this.dmModel = this.configService.getOrThrow('LLM_DM_MODEL');
    }

    /**
     * Runs a full DM turn for a session. Call without awaiting — results are published
     * via StreamPublisher. Handles multi-step tool-use loops until the model returns
     * a final end_turn response.
     */
    async runTurn(sessionId: number, playerInput: string): Promise<void> {
        await this.sessionService.appendEvent(sessionId, EventType.PLAYER_INPUT, { text: playerInput });

        const session = await this.sessionService.findSessionWithCampaign(sessionId);
        const campaignId = session.campaign.id;
        const sceneType = session.sceneType;

        const baseBlock = this.contextLoader.loadBaseBlock(sceneType);
        const campaignBlock = await this.contextLoader.loadCampaignBlock(campaignId);
        const worldBlock = await this.contextLoader.loadWorldBlock(campaignId);
        const historyMessages = await this.contextLoader.loadHistoryBlock(sessionId);

        // historyMessages includes the player input we just persisted as the last item;
        // exclude it so we can supply it as the live uncached user message.
        const priorHistory = historyMessages.slice(0, -1);

        // Mark the history/live-input boundary for cache breakpoint 4
        if (priorHistory.length > 0) {
            const last = priorHistory[priorHistory.length - 1];
            if (typeof last.content === 'string') {
                /* eslint-disable @typescript-eslint/naming-convention */
                priorHistory[priorHistory.length - 1] = {
                    ...last,
                    content: [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }],
                };
                /* eslint-enable @typescript-eslint/naming-convention */
            }
        }

        /* eslint-disable @typescript-eslint/naming-convention */
        const systemBlocks: Anthropic.TextBlockParam[] = [
            { type: 'text', text: baseBlock, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: campaignBlock, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: worldBlock, cache_control: { type: 'ephemeral' } },
        ];
        /* eslint-enable @typescript-eslint/naming-convention */

        const messages: Anthropic.MessageParam[] = [
            ...priorHistory,
            { role: 'user', content: playerInput },
        ];

        const narrativeRef = { text: '' };

        try {
            await this.runToolLoop(sessionId, systemBlocks, messages, narrativeRef);
        } catch (error) {
            this.logger.error(`DM turn failed for session ${sessionId}:`, error);
        } finally {
            if (narrativeRef.text) {
                await this.sessionService.appendEvent(sessionId, EventType.DM_NARRATIVE, {
                    narrative: narrativeRef.text,
                });
            }

            this.streamPublisher.publish(sessionId, { type: DmStreamChunkType.DONE });
        }
    }

    /**
     * Recursive tool loop: streams model output, dispatches any tool calls, and
     * continues until the model returns stop_reason = 'end_turn'.
     */
    private async runToolLoop(
        sessionId: number,
        system: Anthropic.TextBlockParam[],
        messages: Anthropic.MessageParam[],
        narrativeRef: { text: string },
    ): Promise<void> {
        /* eslint-disable @typescript-eslint/naming-convention */
        const stream = this.anthropic.messages.stream({
            model: this.dmModel,
            max_tokens: 2048,
            system,
            tools: DM_TOOLS,
            messages,
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                narrativeRef.text += event.delta.text;
                this.streamPublisher.publish(sessionId, {
                    type: DmStreamChunkType.NARRATIVE_CHUNK,
                    text: event.delta.text,
                });
            }
        }

        const finalMessage = await stream.finalMessage();

        if (finalMessage.stop_reason !== 'tool_use') {
            return;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of finalMessage.content) {
            if (block.type !== 'tool_use') {
                continue;
            }

            const result = await this.toolRegistry.dispatch(
                sessionId,
                block.name,
                block.input as Record<string, unknown>,
            );

            await this.sessionService.appendEvent(sessionId, EventType.TOOL_CALL, {
                toolUseId: block.id,
                toolName: block.name,
                toolInput: block.input,
                toolResult: result,
            });

            this.streamPublisher.publish(sessionId, {
                type: DmStreamChunkType.TOOL_RESULT,
                toolName: block.name,
                toolResult: result,
            });

            /* eslint-disable @typescript-eslint/naming-convention */
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
            });
            /* eslint-enable @typescript-eslint/naming-convention */
        }

        await this.runToolLoop(sessionId, system, [
            ...messages,
            { role: 'assistant', content: finalMessage.content },
            { role: 'user', content: toolResults },
        ], narrativeRef);
    }
}
