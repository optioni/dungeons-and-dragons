## ADDED Requirements

### Requirement: trigger_level_up emits a level-up pause signal after its existing work
The system SHALL continue to perform the existing `trigger_level_up` behavior and SHALL additionally emit a `STATUS` chunk with `status = "LEVEL_UP_PENDING"` for the active DM stream after the tool succeeds.

#### Scenario: trigger_level_up emits LEVEL_UP_PENDING after success
- **WHEN** `trigger_level_up` succeeds for a character in an active DM session
- **THEN** the runtime emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"` before returning control to the client

### Requirement: Game engine tools may trigger stream-only UI side effects
The game engine SHALL support tool handlers whose primary purpose is to emit DM stream chunks for the client UI rather than mutate durable game state. These tools SHALL still return structured success or error envelopes.

#### Scenario: Stream-side effect tools return structured success
- **WHEN** a stream-side effect tool such as `trigger_spell_prep` completes successfully
- **THEN** it returns a structured success result and emits the corresponding DM stream chunk without throwing an exception

