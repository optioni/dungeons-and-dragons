## Why

The core game loop — player inputs text, the DM streams a response — requires a session system, an LLM orchestration layer, and a real-time SSE subscription. This is the heart of the application: context assembly with prompt caching, dynamic prompt module loading per scene type, tool call interception mid-stream, and the GameEvent log.

## What Changes

- `GameSession` entity — campaignId, startedAt, endedAt, sceneType
- `GameEvent` entity — sessionId, type, content, timestamp
- `LLMModule` — Claude Sonnet orchestration, SSE streaming via GraphQL subscription, context assembly with 4 prompt cache breakpoints, dynamic prompt module loading, tool call interception
- `SessionModule` — session lifecycle, player input handling, event logging
- Prompt modules as text files (COMBAT / SOCIAL / EXPLORATION / SETTLEMENT / REST)
- GraphQL subscription `dmStream(sessionId)` over SSE
- `set_scene_type` tool call
- Game view page (`/campaign/[id]/play`) — narrative column, character sidebar, text input, suggested action chips, SSE subscription wired to urql

## Capabilities

### New Capabilities
- `game-session`: Session lifecycle, GameEvent log, player input handling
- `llm-orchestration`: Claude Sonnet streaming, SSE subscription, context assembly, prompt caching, dynamic modules
- `game-view-ui`: Main gameplay screen with narrative column, character sidebar, text input, suggested actions

### Modified Capabilities

## Impact

- New `SessionModule` and `LLMModule` in `api/`
- Depends on `auth`, `campaign-setup`, `character-system`
- All `game-engine` tool calls are dispatched through `LLMModule`
- Most complex change in the project — the streaming tool call loop is the critical path
