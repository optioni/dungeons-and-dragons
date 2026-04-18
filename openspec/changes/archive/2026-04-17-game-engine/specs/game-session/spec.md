## MODIFIED Requirements

### Requirement: Session records persist campaign-scoped play state
The system SHALL persist a `GameSession` record for each gameplay sitting. Each `GameSession` SHALL belong to exactly one `Campaign` and SHALL store `campaignId`, `startedAt`, `endedAt`, `sceneType`, and `levelUpPending` (boolean, default false). The system SHALL allow at most one active session (`endedAt = null`) per campaign at a time.

#### Scenario: Starting a session creates an active record
- **WHEN** the owner of a ready-to-play campaign starts a new session and no active session exists
- **THEN** the system persists a `GameSession` for that campaign with `endedAt = null`, `sceneType = EXPLORATION`, and `levelUpPending = false`

#### Scenario: Campaign cannot have two active sessions
- **WHEN** the owner attempts to start a session for a campaign that already has an active `GameSession`
- **THEN** the system returns the existing active session or rejects the duplicate start request without creating a second active row

#### Scenario: Session access is owner-scoped
- **WHEN** a user requests a `GameSession` for a campaign they do not own
- **THEN** the system returns a not-found or forbidden result and does not expose session data

## ADDED Requirements

### Requirement: A state-changed event is emitted after each game-engine tool call
After each state-changing tool call (apply_damage, heal, give_item, travel_to, update_npc, instant_death), the game engine SHALL emit a `StateChangedEvent` via `EventEmitter2`. The event SHALL include `type` (one of TRAVEL | DAMAGE | GIVE_ITEM | NPC_UPDATE | NPC_KILLED), `entityId` (the affected entity's id), and `campaignId`. The event is fire-and-forget — the tool response is not blocked by event handlers.

#### Scenario: Damage tool emits a DAMAGE state-changed event
- **WHEN** `apply_damage` completes successfully
- **THEN** a `StateChangedEvent` with `type: 'DAMAGE'` and the target's id is emitted

#### Scenario: Travel emits a TRAVEL state-changed event with destination id
- **WHEN** `travel_to` succeeds
- **THEN** a `StateChangedEvent` with `type: 'TRAVEL'` and `entityId` equal to the destination location id is emitted

#### Scenario: State-changed event does not block the tool response
- **WHEN** the event handler for `StateChangedEvent` encounters an error
- **THEN** the tool response has already been returned and the error is logged without affecting the LLM's result
