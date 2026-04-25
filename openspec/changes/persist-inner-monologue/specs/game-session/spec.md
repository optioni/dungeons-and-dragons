## ADDED Requirements

### Requirement: GameSession stores the latest inner monologue text
`GameSession` SHALL include a `lastInnerVoice` field: a nullable text column (default null) that holds the most recently generated inner monologue for the session. It SHALL be exposed on the `GameSession` GraphQL type as a nullable `String`. It SHALL be included in the `activeSession` query response.

#### Scenario: New sessions have no inner monologue
- **WHEN** a new `GameSession` is created
- **THEN** `lastInnerVoice` is null

#### Scenario: Field returned in activeSession query
- **WHEN** the frontend queries `activeSession`
- **THEN** the response includes `lastInnerVoice` (null or a string)
