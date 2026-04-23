## ADDED Requirements

### Requirement: update_room_state tool allows DM to set room state explicitly
The system SHALL expose an `update_room_state(roomId, state)` LLM tool. Valid states are `UNEXPLORED`, `EXPLORED`, `CLEARED`, `LOCKED`, and `TRAPPED`. The tool SHALL validate that the room belongs to the active dungeon's campaign. On success it SHALL persist the new `roomState` on the `Location` row. The tool SHALL fail if `activeDungeonId` is null.

#### Scenario: DM marks a room as cleared
- **WHEN** the DM calls `update_room_state(roomId, "CLEARED")`
- **THEN** the `Location.roomState` is set to `CLEARED` and the updated value is persisted

#### Scenario: Invalid state value is rejected
- **WHEN** the DM calls `update_room_state` with a state value not in the allowed enum
- **THEN** the tool returns `errorCode: INVALID_ROOM_STATE`

#### Scenario: Room from a different campaign is rejected
- **WHEN** the DM calls `update_room_state` with a room id not belonging to the active campaign
- **THEN** the tool returns `errorCode: ROOM_NOT_FOUND`

#### Scenario: Tool rejected outside active dungeon
- **WHEN** `GameSession.activeDungeonId` is null and the DM calls `update_room_state`
- **THEN** the tool returns `errorCode: NO_ACTIVE_DUNGEON`

### Requirement: Room state transitions follow the dungeon lifecycle
Rooms SHALL begin as `UNEXPLORED`. The system SHALL transition a room to `EXPLORED` automatically on first entry via `move_to_room`. The `CLEARED` state SHALL only be set explicitly by the DM via `update_room_state` — the system SHALL NOT auto-clear rooms based on NPC death or other derived signals. `LOCKED` and `TRAPPED` states MAY be set at any time by the DM.

#### Scenario: Newly created rooms start as UNEXPLORED
- **WHEN** a dungeon room Location is created via `create_dungeon`
- **THEN** its `roomState` defaults to `UNEXPLORED`

#### Scenario: Auto-transition to EXPLORED on first move_to_room
- **WHEN** the DM calls `move_to_room` for a room with `roomState = UNEXPLORED`
- **THEN** the room's state transitions to `EXPLORED` automatically

#### Scenario: Explored room stays EXPLORED until DM updates it
- **WHEN** the player re-enters a room with `roomState = EXPLORED`
- **THEN** `roomState` remains `EXPLORED` — no automatic change occurs

#### Scenario: CLEARED state is set only via update_room_state
- **WHEN** all NPCs in a room are killed and combat ends
- **THEN** the room's `roomState` is not automatically changed — the DM must call `update_room_state` to mark it cleared

### Requirement: Room state is included in dungeon room query results
The system SHALL include `roomState` in GraphQL responses for `Location` rows that are dungeon rooms. Clients SHALL be able to filter rooms by `roomState`.

#### Scenario: Dungeon rooms include roomState in query response
- **WHEN** the owner queries rooms for a dungeon
- **THEN** each room includes its current `roomState` value

#### Scenario: Rooms can be filtered by state
- **WHEN** the owner queries rooms with a `roomState` filter (e.g. `CLEARED`)
- **THEN** only rooms matching that state are returned
