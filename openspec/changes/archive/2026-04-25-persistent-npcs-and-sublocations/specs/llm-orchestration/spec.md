## MODIFIED Requirements

### Requirement: DM turn orchestration assembles deterministic runtime context
The system SHALL orchestrate one Claude DM call per accepted player turn. Before invoking the model, the system SHALL assemble context for the active session in a deterministic order consisting of:
1. base system prompt and tool definitions (the full registered game-engine tool set)
2. active scene prompt modules
3. campaign state required for play
4. character state; current location (name, description, parent annotation when applicable); known sub-locations of the current settlement; all NPCs present at the current location; merchant inventory for NPCs with items at the current location; and the last 7 diary entries for the active campaign
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

#### Scenario: Turn context shows parent location name when player is in a sub-location
- **WHEN** `campaign.currentLocationId` resolves to a Location with a non-null `parentLocationId`
- **THEN** the current location line in the world block reads `"<sub-location> (inside <parent>)"` rather than just the sub-location name

#### Scenario: Turn context lists known establishments when at a top-level settlement
- **WHEN** `campaign.currentLocationId` is a top-level location with known sub-locations
- **THEN** the world block includes a known establishments section with each sub-location's name, ID, and description

#### Scenario: Turn context lists all NPCs present at the current location
- **WHEN** one or more NPCs have `currentLocationId` matching the campaign's current location
- **THEN** the world block includes a section listing each NPC's name, ID, profession, and disposition

### Requirement: Prompt caching follows the four breakpoint strategy
The system SHALL implement prompt caching around the four breakpoint groups defined for DM sessions:
1. system prompt, the full registered game-engine tool definitions, and active scene modules
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

#### Scenario: New NPC created at current location invalidates breakpoint 3 cache
- **WHEN** `create_npc` persists a new NPC with `currentLocationId` matching the campaign's current location
- **THEN** the next DM turn rebuilds breakpoint 3 so the new NPC appears in the `## NPCs Present` section

## ADDED Requirements

### Requirement: DM model has access to the full registered game-engine tool set
The system SHALL expose all tool handlers registered in `GameEngineToolRegistrarService` to the DM model via `DM_TOOLS`. Each tool SHALL have a JSON schema definition with accurate parameter descriptions. The registered tool set covers: dice and skill checks, combat lifecycle, rests, travel and location management (including `create_location` and `create_npc`), item management, leveling, world mutations, dungeon navigation, quest lifecycle, campaign management, and memory tools.

#### Scenario: DM can call any registered tool during a turn
- **WHEN** the DM model invokes any tool with a registered handler
- **THEN** the orchestrator dispatches it through `ToolRegistry` and returns a structured result to the model

#### Scenario: DM invokes create_npc to persist a newly introduced NPC
- **WHEN** the DM introduces a named NPC and calls `create_npc`
- **THEN** the tool result includes the new NPC's ID and the model can reference that ID in subsequent tool calls within the same turn

#### Scenario: DM invokes create_location to persist a named establishment
- **WHEN** the DM introduces a named location and calls `create_location` with optional `parent_location_id`
- **THEN** the tool result includes the new location's ID and it becomes referenceable by `travel_to` and other location tools
