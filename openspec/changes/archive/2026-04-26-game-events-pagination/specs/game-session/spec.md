## MODIFIED Requirements

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
