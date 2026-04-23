## MODIFIED Requirements

### Requirement: DM stream subscription publishes normalized typed chunks over SSE
The system SHALL expose a GraphQL subscription `dmStream(sessionId: ID!)` over SSE for the owner of the session. The subscription SHALL emit normalized stream payloads with typed chunk semantics rather than raw Anthropic SDK events. The emitted chunk types SHALL support at least `NARRATIVE_CHUNK`, `TOOL_RESULT`, `SUGGESTED_ACTION`, `STATUS`, and a final completion signal. `SUGGESTED_ACTION` chunks SHALL carry suggested player actions emitted by `suggest_actions`, and `STATUS` chunks SHALL support workflow signals including `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING`.

#### Scenario: Narrative tokens are delivered as normalized chunks
- **WHEN** the DM runtime produces narrative text during a turn
- **THEN** the subscription emits one or more `NARRATIVE_CHUNK` payloads that the client can append to the in-progress message

#### Scenario: Suggested actions are delivered as typed chunks
- **WHEN** the runtime handles a `suggest_actions` tool call
- **THEN** the subscription emits one or more `SUGGESTED_ACTION` chunks for the active DM response

#### Scenario: Pause workflow signals are delivered as status chunks
- **WHEN** the runtime needs the player to complete level-up or spell preparation before continuing freeform play
- **THEN** the subscription emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"` or `status = "SPELL_PREP_PENDING"`

#### Scenario: Stream completion is explicit
- **WHEN** the DM runtime finishes a turn successfully
- **THEN** the subscription emits a final completion payload so the client can finalize the in-progress message state

#### Scenario: Non-owner cannot subscribe to another user's session
- **WHEN** a user subscribes to `dmStream(sessionId)` for a session they do not own
- **THEN** the system rejects the subscription or returns no events for that session

## ADDED Requirements

### Requirement: suggest_actions is treated as a terminal UI tool within a DM turn
The orchestration runtime SHALL treat `suggest_actions` as a terminal tool for the current turn step. After emitting the corresponding `SUGGESTED_ACTION` chunks, the runtime SHALL NOT feed an additional tool result back into the LLM that would cause more same-turn narration to continue from that tool call.

#### Scenario: suggest_actions ends its tool branch after chunk emission
- **WHEN** the LLM invokes `suggest_actions` at the end of a narrative turn
- **THEN** the runtime emits the suggested action chunks and concludes that tool branch without replaying an extra tool-result payload into the model

