## ADDED Requirements

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
