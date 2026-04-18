## MODIFIED Requirements

### Requirement: DM turn orchestration assembles deterministic runtime context
The system SHALL orchestrate one Claude DM call per accepted player turn. Before invoking the model, the system SHALL assemble context for the active session in a deterministic order consisting of:
1. base system prompt and tool definitions (including `search_memories` and `record_memory`)
2. active scene prompt modules
3. campaign state required for play
4. character state, world state, and the last 7 diary entries for the active campaign
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

### Requirement: Prompt caching follows the four breakpoint strategy
The system SHALL implement prompt caching around the four breakpoint groups defined for DM sessions:
1. system prompt, tool definitions (including `search_memories` and `record_memory`), and active scene modules
2. campaign state
3. character state, world state, and the last 7 diary entries for the active campaign
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
