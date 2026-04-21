# LLM Orchestration Spec

## Purpose

Defines how the DM turn is orchestrated — context assembly, prompt caching strategy, scene module loading, tool execution contract, streaming over SSE, and stream resumability.
## Requirements
### Requirement: DM turn orchestration assembles deterministic runtime context
The system SHALL orchestrate one Claude DM call per accepted player turn. Before invoking the model, the system SHALL assemble context for the active session in a deterministic order consisting of:
1. base system prompt and tool definitions (including `search_memories` and `record_memory`)
2. active scene prompt modules
3. campaign state required for play
4. character state, world state, NPC inventory for merchants at `currentLocationId`, and the last 7 diary entries for the active campaign
5. recent memory context and current-session event history
6. the latest player input

#### Scenario: Turn context includes current session history
- **WHEN** the owner submits player input for a session with prior `GameEvent`s
- **THEN** the DM call includes the historical transcript for that session before the new input

#### Scenario: Turn context uses current campaign and world state
- **WHEN** the owner submits player input after campaign lore, location state, or character state has changed
- **THEN** the next DM call reads the latest persisted state rather than stale client-side state

#### Scenario: Turn context includes last 7 diary entries
- **WHEN** the owner submits player input and the active campaign has at least one diary entry
- **THEN** the assembled prompt at cache breakpoint 3 includes the content of the most recent (up to 7) diary entries ordered oldest-first for narrative continuity

#### Scenario: Turn context proceeds without diary entries for new campaigns
- **WHEN** the active campaign has no diary entries
- **THEN** context assembly succeeds and the diary section is omitted without error

#### Scenario: Turn context includes merchant inventory when merchants are present at current location
- **WHEN** the owner submits player input and at least one NPC with `NpcItem` rows is located at the campaign's `currentLocationId`
- **THEN** the assembled prompt at cache breakpoint 3 includes a compact inventory block for each such NPC before the diary section

### Requirement: Prompt caching follows the four breakpoint strategy
The system SHALL implement prompt caching around the four breakpoint groups defined for DM sessions:
1. system prompt, tool definitions (including `search_memories`, `record_memory`, and `record_npc_memory`), and active scene modules
2. campaign state
3. character state, world state, last 7 diary entries, and NPC memories for NPCs at the current location
4. historical session events prior to the latest input

The runtime SHALL structure prompt assembly so these boundaries can be cached and invalidated independently.

#### Scenario: New player input does not invalidate stable prompt layers
- **WHEN** a player submits a new turn without any intervening state-changing tool calls
- **THEN** the runtime reuses the cached prompt layers above the latest-input boundary instead of rebuilding the whole prompt

#### Scenario: Scene change invalidates the scene-module cache layer
- **WHEN** a tool call changes `GameSession.sceneType`
- **THEN** the next DM turn rebuilds the cache layer that contains the active scene module set

#### Scenario: New diary entry invalidates breakpoint 3 cache
- **WHEN** `take_long_rest` creates a new `DiaryEntry` for the campaign
- **THEN** the next DM turn rebuilds the cache layer at breakpoint 3 to include the new diary content

#### Scenario: New NpcMemory at the current location invalidates breakpoint 3 cache
- **WHEN** a new `NpcMemory` row is created for an NPC present at the current session location
- **THEN** the next DM turn rebuilds the cache layer at breakpoint 3 to include the updated NPC memory content

### Requirement: Scene prompt modules are loaded by session scene type
The system SHALL store prompt modules for `EXPLORATION`, `COMBAT`, `SOCIAL`, `SETTLEMENT`, and `REST` as application-managed text assets. The DM runtime SHALL load the module set corresponding to the active `GameSession.sceneType` for each turn.

#### Scenario: Exploration session loads exploration module
- **WHEN** the active session has `sceneType = EXPLORATION`
- **THEN** the DM runtime includes the exploration prompt module in the assembled prompt

#### Scenario: Scene transition swaps the loaded module
- **WHEN** a tool call updates the session scene from `EXPLORATION` to `COMBAT`
- **THEN** the next DM turn includes combat prompt guidance instead of the exploration module

### Requirement: Tool execution uses a structured registry contract
The system SHALL execute LLM-requested tools through a registry that maps tool names to handlers. Every tool handler SHALL return a structured result envelope instead of throwing transport-layer errors. That envelope SHALL include whether the call succeeded and the data or error information required for the narrative to recover gracefully.

#### Scenario: Successful tool call returns structured result
- **WHEN** the DM runtime executes a valid supported tool call
- **THEN** the tool registry returns a structured success payload that is recorded in the session transcript and fed back into the turn

#### Scenario: Invalid tool arguments return structured failure
- **WHEN** the DM runtime executes a supported tool call with invalid arguments
- **THEN** the tool registry returns a structured error payload and the stream continues without crashing the subscription transport

### Requirement: `set_scene_type` updates durable session state
The runtime SHALL support the `set_scene_type(sessionId, sceneType)` tool call. Executing this tool SHALL validate the target session, persist the new `sceneType` on the active `GameSession`, and make that scene transition visible to the active stream consumer.

#### Scenario: Valid scene change updates the session
- **WHEN** the DM runtime executes `set_scene_type` with a supported scene value for the active session
- **THEN** the system updates `GameSession.sceneType` and subsequent turn assembly uses the new scene module set

#### Scenario: Invalid scene change returns structured error
- **WHEN** the DM runtime executes `set_scene_type` with an unsupported scene value or wrong session
- **THEN** the tool result is returned as a structured failure and the existing `sceneType` remains unchanged

### Requirement: DM stream subscription publishes normalized typed chunks over SSE
The system SHALL expose a GraphQL subscription `dmStream(sessionId: ID!)` over SSE for the owner of the session. The subscription SHALL emit normalized stream payloads with typed chunk semantics rather than raw Anthropic SDK events. The emitted chunk types SHALL support at least `NARRATIVE_CHUNK`, `TOOL_RESULT`, `SUGGESTED_ACTION`, `STATUS`, and a final completion signal.

#### Scenario: Narrative tokens are delivered as normalized chunks
- **WHEN** the DM runtime produces narrative text during a turn
- **THEN** the subscription emits one or more `NARRATIVE_CHUNK` payloads that the client can append to the in-progress message

#### Scenario: Stream completion is explicit
- **WHEN** the DM runtime finishes a turn successfully
- **THEN** the subscription emits a final completion payload so the client can finalize the in-progress message state

#### Scenario: Non-owner cannot subscribe to another user's session
- **WHEN** a user subscribes to `dmStream(sessionId)` for a session they do not own
- **THEN** the system rejects the subscription or returns no events for that session

### Requirement: Streaming remains resumable and de-duplicable
The stream publisher SHALL include enough per-session sequencing information for the client to de-duplicate repeated deliveries after SSE reconnects. The runtime SHALL persist finalized `GameEvent`s even if a stream disconnect occurs mid-turn.

#### Scenario: Reconnected client can ignore duplicate chunks
- **WHEN** the SSE client reconnects after already receiving some chunks for the current turn
- **THEN** the stream payloads include session-scoped ordering data that allows the client to discard duplicates

#### Scenario: Finalized narrative survives disconnect
- **WHEN** the SSE connection drops after the player input has been accepted but before the UI receives the final chunk
- **THEN** the completed `DM_NARRATIVE` event remains queryable in the persisted session transcript once the turn finishes

