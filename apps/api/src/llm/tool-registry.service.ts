import { Injectable } from '@nestjs/common';

import { type ToolHandler, type ToolResult } from './tool-registry.js';

/**
 * Maps tool names to handlers and dispatches LLM tool-call requests.
 * Returns structured ToolResult — never throws — so the LLM can recover narratively.
 */
@Injectable()
export class ToolRegistry {
    private readonly handlers = new Map<string, ToolHandler>();

    /** Registers a tool handler. Called during module init by each handler. */
    register(handler: ToolHandler): void {
        this.handlers.set(handler.toolName, handler);
    }

    /** Dispatches a tool call, returning a structured result envelope. */
    async dispatch(sessionId: number, toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
        const handler = this.handlers.get(toolName);
        if (!handler) {
            return {
                success: false,
                errorCode: 'UNKNOWN_TOOL',
                message: `Unknown tool: ${toolName}`,
            };
        }
        try {
            return await handler.execute(sessionId, input);
        } catch (error) {
            return {
                success: false,
                errorCode: 'TOOL_ERROR',
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
