## Context

`session-and-llm` is the first gameplay-runtime change after campaign setup. It introduces the turn loop that turns a prepared campaign into a playable session: starting a `GameSession`, accepting player input, assembling LLM context, streaming the DM response over GraphQL SSE, executing tool calls during the stream, and persisting the resulting `GameEvent` history for later turns.

The change is cross-cutting:
- `apps/api` needs new persistence, GraphQL surface area, session orchestration, and Claude integration.
- `apps/web` needs the main `/campaign/[id]/play` route, subscription wiring, and UI state that can follow streamed narrative plus scene changes.
- The implementation must align with the existing setup work, especially `Campaign.openingSceneSeed`, `Campaign.currentLocationId`, `Campaign.inGameDate`, `Campaign.loreDocument`, and `Campaign.antagonistPlanState`.

Constraints that shape the design:
- GraphQL subscriptions use SSE via GraphQL Yoga; WebSocket infrastructure is out of scope.
- Model names must come from configuration, never from hardcoded literals.
- LLM tool failures must be returned as structured results so the narrative can recover gracefully.
- Prompt caching is a core cost-control mechanism, so context assembly boundaries must be explicit.
- The repo is still in active development, so schema and API breaking changes are acceptable if they simplify the first correct implementation.

## Goals / Non-Goals

**Goals:**
- Introduce a persistent session model and event log that support resumable DM turns.
- Define a single turn pipeline from player input to streamed DM output, including mid-stream tool execution.
- Keep session lifecycle concerns in `SessionModule` and provider-specific LLM concerns in `LLMModule`.
- Make scene-aware prompt assembly deterministic through stored `sceneType` and prompt-module files.
- Deliver a playable web route that can subscribe to DM stream events and reflect character/session state without polling-heavy hacks.

**Non-Goals:**
- Implement the full `GameEngineModule` tool surface; this change only needs the dispatch boundary and the initial `set_scene_type` path.
- Implement world tick, diary writing, or NPC agenda processing beyond the interfaces this runtime will later call.
- Add multi-session concurrency, multiplayer support, or session replay tooling.
- Build a generic event bus abstraction for future features before the runtime requirements justify it.

## Decisions

### 1. Split gameplay ownership between `SessionModule` and `LLMModule`

`SessionModule` should own:
- `GameSession` and `GameEvent` entities
- session start/end mutations
- player input mutation entrypoint
- session-scoped persistence and authorization
- subscription payload publication for a session

`LLMModule` should own:
- DM turn orchestration
- prompt assembly and prompt-cache breakpoint construction
- prompt module loading by scene type
- Claude streaming integration
- tool-call interception and structured tool-result normalization

Rationale:
- `SessionModule` is the source of truth for what happened in play.
- `LLMModule` can evolve around provider behavior and prompt composition without owning campaign/session persistence.
- This keeps later background-Haiku work in `LLMModule` without turning session resolvers into orchestration code.

Alternatives considered:
- Put turn orchestration in `SessionModule`.
  Rejected because provider-specific streaming and cache assembly would leak into the domain module.
- Put `GameSession` persistence inside `LLMModule`.
  Rejected because the LLM layer should consume session state, not own the gameplay record.

### 2. Model one active `GameSession` per campaign and materialize the opening seed into the first event

The API should allow at most one active session (`endedAt IS NULL`) per campaign. Starting a session should:
- validate that the campaign is ready to play
- close no historical sessions automatically unless the user explicitly ends them
- create a new `GameSession` with default `sceneType = EXPLORATION`
- materialize `Campaign.openingSceneSeed` into the first `GameEvent` only for the first session of that campaign
- persist that opening narrative as part of `startSession` so the play view never boots into an empty transcript

`GameEvent` should be append-only, typed, and stored as `jsonb` content for every event variant. The first version of the event model should capture:
- `PLAYER_INPUT`
- `DM_NARRATIVE`
- `TOOL_CALL`
- `SYSTEM`

Rationale:
- A single active session keeps prompt assembly simple and avoids ambiguous stream targets.
- Materializing the opening seed at session creation preserves setup/runtime ownership boundaries established in the earlier change.
- Returning the opening narrative from `startSession` gives the UI a deterministic first render without requiring a synthetic follow-up mutation.
- A single `jsonb` payload shape keeps the event model extensible as tool, combat, and system events grow more structured.
- Append-only history is enough for prompt context, UI transcript rendering, and later diary generation.

Alternatives considered:
- Store the opening scene only in campaign state and inject it on demand.
  Rejected because the first session transcript should be self-contained.
- Allow multiple active sessions per campaign.
  Rejected because later world-state mutations and stream routing would become inconsistent immediately.

### 3. Use a session-scoped stream publisher that emits typed chunks while persisting finalized events

The GraphQL subscription should remain `dmStream(sessionId)` over SSE, but the server should not stream raw provider tokens directly to GraphQL. Instead, `LLMModule` should emit normalized stream messages to a session-scoped publisher with a small union of chunk types:
- `NARRATIVE_CHUNK`
- `TOOL_RESULT`
- `SUGGESTED_ACTION`
- `STATUS`
- final `DONE`

Persistence should happen at event boundaries, not token boundaries:
- accumulate narrative text during the turn
- persist one `DM_NARRATIVE` event when the stream completes or reaches a stable turn boundary
- persist one `PLAYER_INPUT` event before invoking the DM turn
- persist one `TOOL_CALL` event per executed tool call with both request and structured result payload

Suggested actions should be emitted as stream-only UI hints in the first iteration. They should not be persisted as `GameEvent`s until product needs justify transcript history for them.

Rationale:
- The frontend needs typed chunks for rendering, but the database does not need token-level noise.
- Persisting only finalized events keeps transcript reads small and prompt history stable.
- A session-scoped publisher isolates SSE transport from Claude SDK details and makes reconnection behavior easier to control.

Alternatives considered:
- Persist every token as a `GameEvent`.
  Rejected because transcript reads and cache invalidation would become unnecessarily expensive.
- Expose provider-native stream events directly through the GraphQL schema.
  Rejected because it couples API clients to Anthropic event semantics.

### 4. Build DM prompts from deterministic state loaders aligned to the cache breakpoints

`LLMModule` should assemble DM-session context through explicit loaders that correspond to the four cache breakpoints:
1. Base system prompt + tool definitions + scene module text
2. Campaign state block (`loreDocument`, antagonist plan state, faction summary)
3. Character/world block (sheet, current location, active world events, last 7 diary entries)
4. Historical session events (all prior `GameEvent`s for the active session except the latest player input)

Prompt modules for `EXPLORATION`, `COMBAT`, `SOCIAL`, `SETTLEMENT`, and `REST` should live as versioned text assets in `apps/api` and be loaded by a small registry service keyed by `sceneType`.

Rationale:
- The cache strategy only works if the boundaries are explicit in code rather than implicit string concatenation.
- Scene module files are stable artifacts that can be updated without rewriting orchestration code.
- Keeping campaign state separate from character/world state matches the product spec and supports future selective invalidation.

Alternatives considered:
- One prompt builder that concatenates everything inline.
  Rejected because it obscures cache invalidation rules and makes tests coarse.
- Store prompt module text in the database.
  Rejected because these are application assets, not campaign-authored content.

### 5. Execute tool calls through a registry that returns structured outcomes instead of thrown errors

`LLMModule` should not call Nest providers ad hoc. It should depend on a tool registry that maps tool names to handlers returning a shared result envelope:
- `success`
- `data`
- `errorCode`
- `message`

In this change, the registry needs to support:
- `set_scene_type`
- a small number of no-op or stub-safe tool integrations if required for the turn loop tests

The tool handler for `set_scene_type` should update the active `GameSession.sceneType` and emit a stream chunk so the web UI can react immediately.

Rationale:
- Structured envelopes satisfy the project requirement that the LLM can recover narratively from tool failures.
- A registry keeps new tools additive as `GameEngineModule`, `MemoryModule`, and `WorldModule` capabilities land.
- Scene changes need both persistence and live UI notification, so they should travel through the same standardized execution path as other tools.

Alternatives considered:
- Let Claude tool handlers throw and rely on resolver-level exception filters.
  Rejected because the LLM needs the failure as content, not as transport-layer failure.
- Hardcode tool dispatch in a switch inside the streaming loop.
  Rejected because the list will grow quickly and cross module boundaries.

### 6. The play UI should be session-first and recoverable from server state

The `/campaign/[id]/play` page should:
- fetch the campaign plus active session state on load
- create or resume the active session through explicit mutations
- subscribe to `dmStream(sessionId)` only after session identity is known
- render the transcript from persisted `GameEvent`s, then append live streamed chunks optimistically
- update mode-specific UI from durable state (`sceneType`, character data, conditions) instead of inferring long-lived state from stream text

Suggested action chips should be treated as ephemeral stream output. They may be shown immediately in the UI, but the source of truth for the historical transcript remains persisted `GameEvent`s.

Rationale:
- Refresh safety matters because SSE streams can drop and user sessions will be long-lived.
- Durable game state belongs in GraphQL queries and persisted events, not in local component memory.
- A session-first route keeps later combat, inventory, and quest UI extensions anchored to the same shell.

Alternatives considered:
- Treat the whole transcript as client-only state until a turn finishes.
  Rejected because reconnect and resume behavior would be fragile.
- Infer UI mode only from streamed tool result text.
  Rejected because combat/rest/social transitions need durable server state.

## Risks / Trade-offs

- [Long-running turn leaves stream and persistence out of sync] → Persist the `PLAYER_INPUT` event before invocation, publish normalized chunks through one session-scoped service, and finalize the `DM_NARRATIVE` event in a `finally` path with explicit aborted/error handling.
- [Prompt cache invalidation becomes incorrect as more tools land] → Keep cache-block assembly in dedicated loaders with focused tests tied to invalidation triggers instead of one opaque prompt builder.
- [SSE reconnect duplicates visible chunks] → Include monotonic sequence numbers in stream messages and let the client de-duplicate by session plus sequence.
- [Tool handlers start leaking domain-specific logic into `LLMModule`] → Restrict `LLMModule` to the registry contract and keep tool implementations in their owning modules.
- [The transcript schema is too small for later combat/detail events] → Use typed `content` payloads from the start so new event variants can extend shape without rewriting the persistence model.

## Migration Plan

1. Add `GameSession` and `GameEvent` entities plus the required enum types and migration.
2. Introduce `SessionModule` GraphQL mutations/queries/subscription and session-scoped services.
3. Introduce `LLMModule` configuration, prompt asset loading, tool registry contract, and DM turn orchestrator.
4. Wire the first end-to-end path for session start, player input, streamed narrative, and `set_scene_type`.
5. Add the `/campaign/[id]/play` route and connect it to the new GraphQL operations.

Rollback strategy:
- Since the app is not deployed, rollback is a normal code-and-migration revert.
- If partial implementation becomes unstable during development, the route and GraphQL operations can remain hidden behind unfinished schema work until the end-to-end path is green.
