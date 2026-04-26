## ADDED Requirements

### Requirement: gameEvents query supports backward cursor pagination
The `gameEvents` GraphQL query SHALL accept optional `last: Int` and `before: String` arguments and SHALL return a `GameEventConnection` (relay Connection type with `edges` and `pageInfo`). When `last` is provided without `before`, the query SHALL return the most recent `last` events. When `before` is also provided, the query SHALL return the `last` events preceding that cursor. The default value for `last` SHALL be 60.

#### Scenario: Initial load returns the most recent events
- **WHEN** the frontend queries `gameEvents(sessionId, last: 60)` with no `before` cursor
- **THEN** the response contains up to 60 `GameEvent` edges ordered oldest-to-newest, along with `pageInfo.hasPreviousPage` indicating whether older events exist

#### Scenario: Load-earlier returns events before a cursor
- **WHEN** the frontend queries `gameEvents(sessionId, last: 60, before: "<cursor>")` with a valid cursor
- **THEN** the response contains up to 60 events that precede that cursor, ordered oldest-to-newest

#### Scenario: hasPreviousPage is true when older events exist
- **WHEN** the session has more events than the requested `last` count
- **THEN** `pageInfo.hasPreviousPage` is `true` in the response

#### Scenario: hasPreviousPage is false when all events fit in one page
- **WHEN** the total number of events for the session is less than or equal to `last`
- **THEN** `pageInfo.hasPreviousPage` is `false`

#### Scenario: Empty session returns empty connection
- **WHEN** the session has no events
- **THEN** the response contains an empty `edges` array and `hasPreviousPage: false`

### Requirement: ConnectionArgs allows last without before
The shared `ConnectionArgs` GraphQL args type SHALL permit `last` to be used without a `before` cursor. When `last` is provided alone, the query SHALL return the last N items in the ordered set. This aligns with the relay pagination spec and makes the args type usable for initial-load queries across any paginated field.

#### Scenario: last without before is accepted
- **WHEN** a GraphQL query is issued with `last: N` and no `before` argument
- **THEN** the server processes the request and returns the last N items without a validation error
