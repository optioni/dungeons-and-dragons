## ADDED Requirements

### Requirement: suggest_actions emits player option chips for the active DM turn
The system SHALL expose a `suggest_actions` LLM tool that accepts `actions: string[]`. When the LLM invokes the tool during an active DM turn, the runtime SHALL emit one `SUGGESTED_ACTION` stream chunk per action for the current response so the client can render actionable player options.

#### Scenario: Suggested actions are emitted as individual chunks
- **WHEN** the LLM calls `suggest_actions` with three action strings
- **THEN** the runtime emits three `SUGGESTED_ACTION` chunks for the active DM response, each carrying one action string

#### Scenario: Empty action lists are rejected as structured tool failures
- **WHEN** the LLM calls `suggest_actions` with an empty `actions` array
- **THEN** the tool returns a structured error result instead of emitting any stream chunks

