## Why

The web app is the only way to play, but a terminal interface fits the game's text-first nature perfectly — streaming DM narrative, player input, combat state — and opens the game to players who prefer the terminal. A TUI also requires a conversational setup flow (campaign + character creation driven by the DM via tool calls), which is a better experience than the current form-based mutations on both web and TUI.

## What Changes

- New `apps/tui/` package — Ink (React/TypeScript) TUI client with full feature parity: narrative panel, character sidebar, combat tracker, ASCII world map, diary/quest log, and the full setup flow
- New `packages/client/` shared package — GraphQL SSE client, generated types, auth helpers consumed by both `apps/web/` and `apps/tui/`
- New `SETUP` session type — a pre-game session where the DM converses with the player to build the campaign and character via tool calls, then transitions to a `PLAY` session
- New setup tool registry — `select_story_concept`, `confirm_world_seed`, `create_character` (idempotent draft), `confirm_character` (locks character and transitions session to PLAY)
- `create_character` tool is idempotent during SETUP — calling it again replaces the draft; no separate edit tool needed
- Campaign world seed generation and concept selection are triggered by the DM autonomously within the SETUP session rather than as discrete GraphQL mutations from the client

## Capabilities

### New Capabilities
- `tui-app`: Ink-based TUI client in `apps/tui/` — full play and setup experience in the terminal, consuming the same GraphQL/SSE API as the web client
- `tui-world-map`: ASCII world map renderer using `Location.coordinates` and `Location.connectedLocationIds` — draws locations as labeled nodes connected by edges, respects `LocationDiscovery` visibility
- `setup-session`: New `SETUP` session type and setup tool registry — DM-driven conversational campaign and character creation, transitions to `PLAY` on `confirm_character`
- `shared-client`: `packages/client/` shared package with GraphQL SSE client, codegen'd types, and auth token management

### Modified Capabilities
- `game-session`: Add `SessionType` enum (`SETUP` | `PLAY`); `DmOrchestrator` loads tool registry based on session type; setup session has no scene type or prompt modules
- `llm-orchestration`: Tool registry is selected per session type rather than always loading `GameEngineToolRegistrar`; setup tool handlers live in a new `SetupToolRegistrar`

## Impact

- New `apps/tui/` app — Ink, `graphql-sse` client, Node process
- New `packages/client/` — shared across web and TUI
- `apps/api/src/session/` — `GameSession` entity gets `sessionType` field; `DmOrchestrator` branches on it
- `apps/api/src/llm/` — new `SetupToolRegistrar` with 4 handlers
- `apps/api/src/campaign/` — `generateCampaignStoryConcepts` and `generateCampaignWorldSeed` called internally by setup tool handlers rather than only via GraphQL mutations
- No breaking changes to existing GraphQL API — web app continues to use current mutations unchanged
