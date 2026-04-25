## ADDED Requirements

### Requirement: Inner monologue persisted to session after generation
After `InnerMonologueService` assembles the final monologue text and publishes it as `INNER_VOICE` SSE chunks, it SHALL write the text to `GameSession.lastInnerVoice` and flush to the database. A flush failure SHALL be caught, logged, and swallowed — it SHALL NOT prevent the SSE stream from completing normally.

#### Scenario: Monologue text saved after streaming
- **WHEN** `InnerMonologueService.runIfApplicable` finishes generating and publishing monologue text
- **THEN** `GameSession.lastInnerVoice` is set to the generated text and persisted

#### Scenario: Flush failure is swallowed
- **WHEN** the database flush after monologue generation throws an error
- **THEN** the error is logged and the method returns without re-throwing; the SSE stream is unaffected

### Requirement: lastInnerVoice cleared when player sends input
`SessionResolver.sendPlayerInput` SHALL set `session.lastInnerVoice = null` and flush before firing `DmOrchestrator.runTurn`. This ensures the stale monologue is removed at the moment the player acts, regardless of whether a new monologue will be generated for the upcoming turn.

#### Scenario: Stale monologue cleared on new input
- **WHEN** a player submits input for a session that has a non-null `lastInnerVoice`
- **THEN** `lastInnerVoice` is set to null in the database before the new DM turn begins

#### Scenario: Clearing with null is a no-op
- **WHEN** a player submits input for a session where `lastInnerVoice` is already null
- **THEN** the flush proceeds without error and the turn fires normally

### Requirement: Frontend restores inner monologue from session on page load
When `play.vue` mounts and fetches the active session, it SHALL read `lastInnerVoice` from the returned `GameSession` and use it to seed `innerVoiceText` if the value is non-null. This restores the monologue display after a page reload without any additional network request.

#### Scenario: Monologue restored after reload
- **WHEN** the page loads and `activeSession.lastInnerVoice` is a non-empty string
- **THEN** `innerVoiceText` is initialised to that string and the monologue panel is visible

#### Scenario: No monologue shown when field is null
- **WHEN** the page loads and `activeSession.lastInnerVoice` is null
- **THEN** `innerVoiceText` remains empty and the monologue panel is not shown
