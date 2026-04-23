## ADDED Requirements

### Requirement: enter_dungeon tool activates dungeon mode on the session
The system SHALL expose an `enter_dungeon(dungeonId)` LLM tool. On success it SHALL set `GameSession.activeDungeonId` to the given dungeon id and set `sceneType` to `DUNGEON`. The tool SHALL fail if the dungeon does not belong to the session's campaign. The tool SHALL fail if `activeDungeonId` is already set.

#### Scenario: Entering a valid dungeon activates dungeon mode
- **WHEN** the DM calls `enter_dungeon` with a dungeon id belonging to the active campaign
- **THEN** `GameSession.activeDungeonId` is set to that id and `sceneType` becomes `DUNGEON`

#### Scenario: Entering a dungeon from another campaign is rejected
- **WHEN** the DM calls `enter_dungeon` with a dungeon id from a different campaign
- **THEN** the tool returns a structured error with `errorCode: DUNGEON_NOT_FOUND` and `activeDungeonId` remains unchanged

#### Scenario: Re-entering while already in a dungeon is rejected
- **WHEN** `activeDungeonId` is non-null and the DM calls `enter_dungeon`
- **THEN** the tool returns a structured error with `errorCode: DUNGEON_ALREADY_ACTIVE`

### Requirement: move_to_room tool navigates between connected rooms
The system SHALL expose a `move_to_room(roomId)` LLM tool. It SHALL validate that an active dungeon exists on the session, that the target room's `dungeonId` matches `activeDungeonId`, and that the target room id appears in the current room's `connectedLocationIds`. On success it SHALL update the session's current room reference and transition the target room from `UNEXPLORED` to `EXPLORED` if it was previously unexplored. It SHALL roll the wandering monster die if `Dungeon.encounterTable` is non-null.

#### Scenario: Moving to a connected room succeeds
- **WHEN** the DM calls `move_to_room` with a room id that is in the current room's `connectedLocationIds`
- **THEN** the session's current room updates and the tool returns success

#### Scenario: Moving to a disconnected room is rejected
- **WHEN** the DM calls `move_to_room` with a room id not in `connectedLocationIds`
- **THEN** the tool returns a structured error with `errorCode: ROOM_NOT_CONNECTED`

#### Scenario: Entering an unexplored room marks it explored
- **WHEN** the DM calls `move_to_room` for a room with `roomState = UNEXPLORED`
- **THEN** the room's `roomState` is updated to `EXPLORED`

#### Scenario: Wandering monster die fires when encounter table exists
- **WHEN** the DM calls `move_to_room` and `Dungeon.encounterTable` is non-null
- **THEN** the tool result includes `wanderingMonsterTriggered: true` or `false` based on a d6 roll (triggered on 1)

#### Scenario: move_to_room is rejected outside an active dungeon
- **WHEN** `GameSession.activeDungeonId` is null and the DM calls `move_to_room`
- **THEN** the tool returns a structured error with `errorCode: NO_ACTIVE_DUNGEON`

### Requirement: exit_dungeon tool deactivates dungeon mode
The system SHALL expose an `exit_dungeon()` LLM tool. On success it SHALL set `GameSession.activeDungeonId` to null. The `sceneType` SHALL be set to `EXPLORATION`. The tool SHALL fail if `activeDungeonId` is null.

#### Scenario: Exiting a dungeon clears active dungeon state
- **WHEN** the DM calls `exit_dungeon` while `activeDungeonId` is set
- **THEN** `activeDungeonId` is set to null and `sceneType` becomes `EXPLORATION`

#### Scenario: Exiting when not in a dungeon is rejected
- **WHEN** `activeDungeonId` is null and the DM calls `exit_dungeon`
- **THEN** the tool returns a structured error with `errorCode: NO_ACTIVE_DUNGEON`

### Requirement: activeDungeonId persists through COMBAT scene changes
The system SHALL NOT clear `activeDungeonId` when `sceneType` changes to `COMBAT`. When `sceneType` returns to `DUNGEON` (via `set_scene_type`), `activeDungeonId` SHALL remain set from before the combat started.

#### Scenario: Combat in a dungeon does not lose dungeon context
- **WHEN** the DM calls `set_scene_type(COMBAT)` while `activeDungeonId` is set
- **THEN** `activeDungeonId` remains unchanged on the session

#### Scenario: Dungeon context is restored after combat ends
- **WHEN** the DM calls `set_scene_type(DUNGEON)` after a combat scene
- **THEN** `activeDungeonId` is still set and dungeon-scoped tools remain available
