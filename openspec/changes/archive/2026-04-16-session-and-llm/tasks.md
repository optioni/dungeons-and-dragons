## 1. Database Entities & Migration

- [x] 1.1 Define `SceneType` enum (`EXPLORATION`, `COMBAT`, `SOCIAL`, `SETTLEMENT`, `REST`) and `EventType` enum (`PLAYER_INPUT`, `DM_NARRATIVE`, `TOOL_CALL`, `SYSTEM`) in shared types
- [x] 1.2 Create `GameSession` entity with fields: `id`, `campaign` (ManyToOne), `startedAt`, `endedAt` (nullable), `sceneType` (default `EXPLORATION`), `events` (OneToMany)
- [x] 1.3 Create `GameEvent` entity with fields: `id`, `session` (ManyToOne), `eventType`, `content` (jsonb), `createdAt`; annotate as append-only (no update path)
- [x] 1.4 Generate and verify MikroORM migration for `game_session` and `game_event` tables

## 2. SessionModule — Persistence & Authorization

- [x] 2.1 Scaffold `SessionModule` (module, service, resolver) and register it in `AppModule`
- [x] 2.2 Implement `SessionService.startSession(campaignId, userId)`: validate campaign ownership and readiness, enforce one-active-session-per-campaign, create `GameSession` with `sceneType = EXPLORATION`, materialize `Campaign.openingSceneSeed` as a `DM_NARRATIVE` `GameEvent` for the first session only
- [x] 2.3 Implement `SessionService.endSession(sessionId, userId)`: validate ownership, set `endedAt`, return updated session
- [x] 2.4 Implement `SessionService.getActiveSession(campaignId, userId)`: return the single `endedAt IS NULL` session for the campaign, owner-scoped
- [x] 2.5 Implement `SessionService.getGameEvents(sessionId, userId)`: return events ordered chronologically, owner-scoped
- [x] 2.6 Implement `SessionService.appendEvent(sessionId, eventType, content)`: internal method to persist a typed `GameEvent` — used by turn pipeline, not exposed directly
- [x] 2.7 Write unit tests for `SessionService` (start/end lifecycle, one-active constraint, first-session seed materialization, owner-scope enforcement)

## 3. SessionModule — GraphQL Surface

- [x] 3.1 Define `GameSession` GraphQL object type with `id`, `sceneType`, `startedAt`, `endedAt`, `campaignId`
- [x] 3.2 Define `GameEvent` GraphQL object type with `id`, `sessionId`, `eventType`, `content` (JSON scalar), `createdAt`
- [x] 3.3 Implement `startSession(campaignId: ID!)` mutation — returns `GameSession`; requires auth
- [x] 3.4 Implement `endSession(sessionId: ID!)` mutation — returns `GameSession`; requires auth
- [x] 3.5 Implement `activeSession(campaignId: ID!)` query — returns nullable `GameSession`; requires auth
- [x] 3.6 Implement `gameEvents(sessionId: ID!)` query — returns `[GameEvent!]!` ordered oldest-first; requires auth
- [x] 3.7 Write integration tests for `startSession`, `endSession`, `activeSession`, and `gameEvents` resolvers

## 4. LLMModule — Scaffold & Configuration

- [x] 4.1 Scaffold `LLMModule` (module, service(s)) and register it in `AppModule`; read `LLM_DM_MODEL` and `LLM_BACKGROUND_MODEL` from `ConfigService` — no hardcoded model names
- [x] 4.2 Create prompt module text asset files under `apps/api/src/llm/prompt-modules/`: `exploration.txt`, `combat.txt`, `social.txt`, `settlement.txt`, `rest.txt` with placeholder scene guidance text
- [x] 4.3 Implement `PromptModuleRegistry` service: loads scene module files at startup keyed by `SceneType`, exposes `getModule(sceneType: SceneType): string`

## 5. LLMModule — Tool Registry

- [x] 5.1 Define `ToolResult` interface: `{ success: boolean; data?: unknown; errorCode?: string; message?: string }`
- [x] 5.2 Define `ToolHandler` interface and `ToolRegistry` service that maps tool names to handlers; inject into `DmOrchestrator`
- [x] 5.3 Implement `SetSceneTypeHandler`: validate `sceneType`, update `GameSession.sceneType` via `SessionService`, emit a `STATUS` stream chunk; return structured `ToolResult`
- [x] 5.4 Register `set_scene_type` in `ToolRegistry`
- [x] 5.5 Write unit tests for `ToolRegistry` dispatch and `SetSceneTypeHandler` (valid scene change, invalid scene value, wrong session)

## 6. LLMModule — Context Assembly

- [x] 6.1 Implement `ContextLoader` with four explicit prompt-block methods aligned to cache breakpoints:
  - `loadBaseBlock(sceneType)` — system prompt + tool definitions + scene module text
  - `loadCampaignBlock(campaignId)` — lore document, antagonist plan state, faction summary
  - `loadWorldBlock(campaignId, characterId)` — character sheet, current location, active world events, last 7 diary entries
  - `loadHistoryBlock(sessionId)` — all prior `GameEvent`s except the latest player input
- [x] 6.2 Format `GameEvent` history into Anthropic message format (alternating user/assistant turns for `PLAYER_INPUT` / `DM_NARRATIVE`, tool call/result pairs for `TOOL_CALL`)
- [x] 6.3 Write unit tests for each block loader (correct fields included, ordering, tool message formatting)

## 7. LLMModule — DM Turn Orchestration & Streaming

- [x] 7.1 Implement `StreamPublisher` service: session-scoped async iterable that emits typed chunks (`NARRATIVE_CHUNK`, `TOOL_RESULT`, `SUGGESTED_ACTION`, `STATUS`, `DONE`) with monotonic per-session sequence numbers
- [x] 7.2 Implement `DmOrchestrator.runTurn(sessionId, playerInput)`:
  - persist `PLAYER_INPUT` event before invoking Claude
  - assemble prompt using `ContextLoader` blocks with cache-control headers at each breakpoint
  - stream from Anthropic SDK using `LLM_DM_MODEL`
  - intercept tool-use blocks: call `ToolRegistry.dispatch()`, emit `TOOL_RESULT` chunk, persist `TOOL_CALL` event
  - accumulate narrative text across stream; on completion persist one `DM_NARRATIVE` event
  - emit `DONE` chunk and finalize in a `finally` path so persistence survives SSE disconnects
- [x] 7.3 Write unit tests for `DmOrchestrator`: PLAYER_INPUT persisted before call, tool dispatch invoked, TOOL_CALL event persisted, DM_NARRATIVE persisted on completion, DONE emitted

## 8. SessionModule — Player Input Mutation & dmStream Subscription

- [x] 8.1 Implement `sendPlayerInput(sessionId: ID!, text: String!)` mutation: validate owner, non-blank input, active session; delegate to `DmOrchestrator.runTurn()`; requires auth
- [x] 8.2 Define `DmStreamChunk` GraphQL union/object type: `type`, `sequence`, `text` (for narrative), `toolName`/`toolResult` (for tool), `action` (for suggested), `status`
- [x] 8.3 Implement `dmStream(sessionId: ID!)` GraphQL subscription over SSE: validate owner, subscribe to `StreamPublisher` for session, emit typed chunks; non-owner receives no events
- [x] 8.4 Write integration tests for `sendPlayerInput` (blank rejection, ended-session rejection) and `dmStream` (owner receives chunks, non-owner rejected)

## 9. Web — Play Route Scaffolding

- [x] 9.1 Create `/campaign/[id]/play` Nuxt page; add route guard verifying auth and campaign ownership (redirect to campaign list if unowned)
- [x] 9.2 Write GraphQL operations file with: `ActiveSessionQuery`, `GameEventsQuery`, `StartSessionMutation`, `EndSessionMutation`, `SendPlayerInputMutation`, `DmStreamSubscription`
- [x] 9.3 On page load: query `activeSession(campaignId)`; if none, call `startSession`; once session id is known, query `gameEvents` and subscribe to `dmStream`

## 10. Web — Transcript & Streaming UI

- [x] 10.1 Build `TranscriptView` component: renders persisted `GameEvent` list (`PLAYER_INPUT` as player bubble, `DM_NARRATIVE` as DM message)
- [x] 10.2 Wire `dmStream` subscription: append `NARRATIVE_CHUNK` tokens to an in-progress DM message; de-duplicate by session sequence number on reconnect
- [x] 10.3 On stream `DONE`: refetch `gameEvents` and replace the in-progress optimistic message with the persisted `DM_NARRATIVE` event to avoid duplication

## 11. Web — Player Input & Suggested Actions

- [x] 11.1 Build player input textarea + send button; disable both while the session has an active in-progress stream (track via `isStreaming` ref)
- [x] 11.2 On submit: validate non-empty, call `SendPlayerInputMutation`, immediately append a local `PLAYER_INPUT` bubble to the transcript
- [x] 11.3 Render `SUGGESTED_ACTION` stream chunks as ephemeral action chips below the transcript; clear chips when a new player turn begins

## 12. Web — Character Sidebar & Scene State

- [x] 12.1 Build `CharacterSidebar` component: shows name, HP / max HP, AC, level, active conditions, spell-slot summary; fetch from existing character query
- [x] 12.2 Refetch character query after each completed DM turn (post `DONE` chunk) to reflect stat changes from tool calls
- [x] 12.3 Track `sceneType` from active session; update the play shell layout when a `STATUS` chunk with scene change is received; persist awareness of new `sceneType` for the next `dmStream` reconnect
