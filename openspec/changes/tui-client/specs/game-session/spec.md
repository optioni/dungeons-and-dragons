## MODIFIED Requirements

### Requirement: Session records persist campaign-scoped play state
The system SHALL persist a `GameSession` record for each gameplay sitting. Each `GameSession` SHALL belong to exactly one `Campaign` and SHALL store `campaignId`, `startedAt`, `endedAt`, `sceneType`, `sessionType` (enum: `SETUP` | `PLAY`, default `PLAY`), `levelUpPending` (boolean, default false), and `activeDungeonId` (FK → Dungeon, nullable, default null). The system SHALL allow at most one active session (`endedAt = null`) per campaign at a time.

#### Scenario: Starting a session creates an active PLAY record
- **WHEN** the owner of a ready-to-play campaign starts a new session and no active session exists
- **THEN** the system persists a `GameSession` for that campaign with `endedAt = null`, `sessionType = PLAY`, `sceneType = EXPLORATION`, `levelUpPending = false`, and `activeDungeonId = null`

#### Scenario: Starting a SETUP session creates an active record with no scene type
- **WHEN** a SETUP session is created for a campaign
- **THEN** the system persists a `GameSession` with `sessionType = SETUP` and `sceneType = null`

#### Scenario: Campaign cannot have two active sessions
- **WHEN** the owner attempts to start a session for a campaign that already has an active `GameSession`
- **THEN** the system returns the existing active session or rejects the duplicate start request without creating a second active row

#### Scenario: Session access is owner-scoped
- **WHEN** a user requests a `GameSession` for a campaign they do not own
- **THEN** the system returns a not-found or forbidden result and does not expose session data

#### Scenario: confirm_character transitions sessionType from SETUP to PLAY
- **WHEN** the `confirm_character` tool handler executes successfully within a SETUP session
- **THEN** `GameSession.sessionType` is set to `PLAY` and persisted before the tool result is returned to the LLM
