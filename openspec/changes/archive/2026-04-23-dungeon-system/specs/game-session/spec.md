## ADDED Requirements

### Requirement: GameSession tracks the active dungeon
The system SHALL add an `activeDungeonId` field (FK → Dungeon, nullable) to `GameSession`. This field SHALL be null by default and SHALL only be set or cleared by `enter_dungeon` and `exit_dungeon` tool calls respectively. Scene type changes (including to `COMBAT` and back) SHALL NOT modify `activeDungeonId`.

#### Scenario: New sessions have no active dungeon
- **WHEN** a new `GameSession` is created
- **THEN** `activeDungeonId` is null

#### Scenario: Active dungeon survives a scene type change
- **WHEN** `activeDungeonId` is set and `sceneType` changes to `COMBAT`
- **THEN** `activeDungeonId` remains unchanged on the session row

## MODIFIED Requirements

### Requirement: Session records persist campaign-scoped play state
The system SHALL persist a `GameSession` record for each gameplay sitting. Each `GameSession` SHALL belong to exactly one `Campaign` and SHALL store `campaignId`, `startedAt`, `endedAt`, `sceneType`, `levelUpPending` (boolean, default false), and `activeDungeonId` (FK → Dungeon, nullable, default null). The system SHALL allow at most one active session (`endedAt = null`) per campaign at a time.

#### Scenario: Starting a session creates an active record
- **WHEN** the owner of a ready-to-play campaign starts a new session and no active session exists
- **THEN** the system persists a `GameSession` for that campaign with `endedAt = null`, `sceneType = EXPLORATION`, `levelUpPending = false`, and `activeDungeonId = null`

#### Scenario: Campaign cannot have two active sessions
- **WHEN** the owner attempts to start a session for a campaign that already has an active `GameSession`
- **THEN** the system returns the existing active session or rejects the duplicate start request without creating a second active row

#### Scenario: Session access is owner-scoped
- **WHEN** a user requests a `GameSession` for a campaign they do not own
- **THEN** the system returns a not-found or forbidden result and does not expose session data
