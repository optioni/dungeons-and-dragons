## MODIFIED Requirements

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
