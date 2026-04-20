export interface ToolResult {
    success: boolean
    data?: unknown
    errorCode?: string
    message?: string
    questCompleted?: { questId: number; questTitle: string }
}

export interface ToolHandler {
    /** Tool name as sent by the LLM. */
    toolName: string
    /** Executes the tool. Never throws — returns a structured ToolResult instead. */
    execute: (sessionId: number, input: Record<string, unknown>) => Promise<ToolResult>
}
