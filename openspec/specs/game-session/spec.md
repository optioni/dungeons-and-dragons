# Game Session Spec

## Purpose

Defines the durable session model for gameplay sittings — how sessions are created, how game events form an append-only transcript, how player input is accepted, and how sessions are ended.
## Requirements
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

### Requirement: GameSession tracks the active dungeon
The system SHALL add an `activeDungeonId` field (FK → Dungeon, nullable) to `GameSession`. This field SHALL be null by default and SHALL only be set or cleared by `enter_dungeon` and `exit_dungeon` tool calls respectively. Scene type changes (including to `COMBAT` and back) SHALL NOT modify `activeDungeonId`.

#### Scenario: New sessions have no active dungeon
- **WHEN** a new `GameSession` is created
- **THEN** `activeDungeonId` is null

#### Scenario: Active dungeon survives a scene type change
- **WHEN** `activeDungeonId` is set and `sceneType` changes to `COMBAT`
- **THEN** `activeDungeonId` remains unchanged on the session row

### Requirement: Starting the first session materializes the opening narrative
The system SHALL expose a `startSession` mutation for an authenticated campaign owner. When the first session for a campaign is created, the mutation SHALL materialize `Campaign.openingSceneSeed` into the first persisted `GameEvent` so the play transcript has an initial DM message before any player input is sent.

#### Scenario: First session includes opening narrative event
- **WHEN** the owner calls `startSession` for a campaign that has no prior sessions and has a persisted `openingSceneSeed`
- **THEN** the mutation creates the session and persists an initial `DM_NARRATIVE` `GameEvent` derived from that opening scene seed

#### Scenario: Later sessions do not duplicate the opening seed
- **WHEN** the owner starts a later session for a campaign that already has historical sessions
- **THEN** the new session is created without re-materializing the original opening narrative as a new event

### Requirement: Game events form an append-only transcript
The system SHALL persist `GameEvent` records as the durable transcript for a session. Each `GameEvent` SHALL belong to exactly one `GameSession`, SHALL have a typed `eventType`, SHALL store its `content` as `jsonb`, and SHALL record a creation timestamp. The first version of the event model SHALL support at least `PLAYER_INPUT`, `DM_NARRATIVE`, `TOOL_CALL`, and `SYSTEM`.

#### Scenario: Player input is persisted as structured event data
- **WHEN** the owner submits a valid turn input for an active session
- **THEN** the system appends a `PLAYER_INPUT` event whose `content` includes the submitted text in structured `jsonb` form

#### Scenario: Narrative output is persisted as structured event data
- **WHEN** a DM turn completes successfully for an active session
- **THEN** the system appends a `DM_NARRATIVE` event whose `content` stores the finalized narrative payload in `jsonb`

#### Scenario: Tool execution is persisted as structured event data
- **WHEN** a DM turn executes a tool call
- **THEN** the system appends a `TOOL_CALL` event whose `content` includes the tool name, arguments, structured result, and success or failure state

### Requirement: Session queries return transcript state for resume
The system SHALL expose owner-scoped GraphQL queries for retrieving gameplay session state. The query surface SHALL allow the play UI to fetch the active session for a campaign and its historical `GameEvent` transcript in chronological order. The `gameEvents` field SHALL return a `GameEventConnection` with relay cursor pagination, accepting `last: Int` (default 60) and `before: String` arguments. The context loader SHALL continue to read all events directly via ORM and is not subject to this pagination.

#### Scenario: Play route can fetch active session for a campaign
- **WHEN** the owner queries for the current gameplay state of a campaign with an active session
- **THEN** the response includes the active `GameSession` identifier, its `sceneType`, and the paginated transcript needed to resume play

#### Scenario: Transcript is ordered oldest to newest
- **WHEN** the owner queries the `GameEvent` history for a session
- **THEN** the returned events are ordered chronologically from earliest to latest so the client can render the transcript without re-sorting

#### Scenario: gameEvents returns a relay Connection
- **WHEN** the owner queries `gameEvents(sessionId: ID!, last: 60)` for an active session
- **THEN** the response is a `GameEventConnection` with `edges[].node`, `edges[].cursor`, and `pageInfo.hasPreviousPage`

#### Scenario: Omitting last defaults to 60 events
- **WHEN** the owner queries `gameEvents(sessionId: ID!)` without specifying `last`
- **THEN** the response contains at most 60 events

### Requirement: Player input is accepted only for an active owned session
The system SHALL expose a mutation for sending player input into an active session. The mutation SHALL validate that the session belongs to the authenticated user through the owning campaign, SHALL reject blank input, and SHALL reject input for an ended session.

#### Scenario: Valid player input is accepted
- **WHEN** the owner submits non-empty text for an active session
- **THEN** the system persists a `PLAYER_INPUT` event and begins the DM turn orchestration for that session

#### Scenario: Blank input is rejected
- **WHEN** the owner submits empty or whitespace-only player input
- **THEN** the mutation returns a validation error and no `GameEvent` is created

#### Scenario: Ended session rejects new input
- **WHEN** the owner submits player input for a session whose `endedAt` is set
- **THEN** the mutation returns an error indicating the session is no longer active and does not invoke the DM turn

### Requirement: Sessions can be ended explicitly
The system SHALL expose an `endSession` mutation for the owner of an active session. Ending a session SHALL set `endedAt` on that session and SHALL prevent further player input from being accepted for it. Additionally, `SessionService` SHALL expose an internal `endActiveSession(campaignId)` method callable by `CampaignService` when a campaign transitions to `ENDED` status — this path does not require a GraphQL mutation call.

#### Scenario: Owner ends an active session
- **WHEN** the owner calls `endSession` for their active `GameSession`
- **THEN** the system sets `endedAt` and returns the session as ended

#### Scenario: Ended session is not considered active
- **WHEN** the owner queries the active session for a campaign after calling `endSession`
- **THEN** the ended session is not returned as the campaign's active session

#### Scenario: Campaign end force-terminates the active session
- **WHEN** `CampaignService.endCampaign()` is called for a campaign with an active session
- **THEN** `SessionService.endActiveSession(campaignId)` sets `endedAt` on that session without requiring user interaction

#### Scenario: Ended campaign session rejects player input
- **WHEN** the owner submits player input for a session that was force-ended via campaign closure
- **THEN** the mutation returns an error indicating the session is no longer active

### Requirement: GameSession stores the latest inner monologue text
`GameSession` SHALL include a `lastInnerVoice` field: a nullable text column (default null) that holds the most recently generated inner monologue for the session. It SHALL be exposed on the `GameSession` GraphQL type as a nullable `String`. It SHALL be included in the `activeSession` query response.

#### Scenario: New sessions have no inner monologue
- **WHEN** a new `GameSession` is created
- **THEN** `lastInnerVoice` is null

#### Scenario: Field returned in activeSession query
- **WHEN** the frontend queries `activeSession`
- **THEN** the response includes `lastInnerVoice` (null or a string)

### Requirement: Game events include player-visible mechanical events
The system SHALL support a durable `PLAYER_VISIBLE_EVENT` game event type for curated player-facing mechanical consequences. `PLAYER_VISIBLE_EVENT` records SHALL belong to the active `GameSession`, SHALL store their normalized payload in `content` jsonb, and SHALL be returned by the session `gameEvents` query in chronological order alongside narrative, player input, dice roll, and internal tool-call events.

#### Scenario: Visible event is persisted in session history
- **WHEN** a successful player-relevant tool result is mapped into a visible mechanical event
- **THEN** the system appends a `PLAYER_VISIBLE_EVENT` row to the active session's `game_event` history

#### Scenario: Visible event survives page reload
- **WHEN** the player reloads the play route after a visible mechanical event was persisted
- **THEN** the `gameEvents` query returns that `PLAYER_VISIBLE_EVENT` in its chronological position

#### Scenario: Internal tool call remains persisted separately
- **WHEN** a tool call produces a player-visible mechanical event
- **THEN** the system still preserves the internal `TOOL_CALL` event for orchestration history and persists the player-facing event as a separate row

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

