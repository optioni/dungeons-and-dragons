## MODIFIED Requirements

### Requirement: suggest_actions emits player option chips and an optional pending check hint
The system SHALL expose a `suggest_actions` LLM tool that accepts `actions: string[]` and an optional `pending_check` object. When the LLM invokes the tool during an active DM turn, the runtime SHALL emit one `SUGGESTED_ACTION` stream chunk per action for the current response so the client can render actionable player options.

If `pending_check` is present, it SHALL contain either a `skill` string (e.g. "Persuasion") or an `ability` string (e.g. "CHA"), and a required `dc` integer. When present, the runtime SHALL emit a single `PENDING_CHECK` stream chunk before the `SUGGESTED_ACTION` chunks, carrying `{ skill?, ability?, dc }`. If `pending_check` is absent or omitted, no `PENDING_CHECK` chunk is emitted.

#### Scenario: Suggested actions are emitted as individual chunks
- **WHEN** the LLM calls `suggest_actions` with three action strings and no `pending_check`
- **THEN** the runtime emits three `SUGGESTED_ACTION` chunks for the active DM response, each carrying one action string, and no `PENDING_CHECK` chunk is emitted

#### Scenario: Empty action lists are rejected as structured tool failures
- **WHEN** the LLM calls `suggest_actions` with an empty `actions` array
- **THEN** the tool returns a structured error result instead of emitting any stream chunks

#### Scenario: pending_check emits a PENDING_CHECK chunk before action chunks
- **WHEN** the LLM calls `suggest_actions` with actions and `pending_check: { skill: "Persuasion", dc: 12 }`
- **THEN** the runtime emits one `PENDING_CHECK` chunk with `{ skill: "Persuasion", dc: 12 }` followed by the `SUGGESTED_ACTION` chunks

#### Scenario: pending_check with ability emits the ability field
- **WHEN** the LLM calls `suggest_actions` with `pending_check: { ability: "STR", dc: 14 }`
- **THEN** the runtime emits one `PENDING_CHECK` chunk with `{ ability: "STR", dc: 14 }`

### Requirement: The frontend displays the pending check hint above action buttons and clears it on send
The frontend SHALL display the pending check hint — skill or ability name plus DC — as a single italic muted line above the suggested action buttons when a `PENDING_CHECK` chunk is received. The hint SHALL be cleared when the player sends any input, regardless of whether they used a suggested action or typed custom text.

#### Scenario: Pending check hint is shown above action buttons
- **WHEN** the frontend receives a `PENDING_CHECK` chunk with `{ skill: "Persuasion", dc: 12 }`
- **THEN** a line reading "a Persuasion check awaits · DC 12" is displayed above the suggested action buttons in IM Fell English italic muted style

#### Scenario: Pending check hint is cleared on player send
- **WHEN** the player sends any input (suggested action or custom text)
- **THEN** the pending check hint is cleared immediately before the input is submitted

#### Scenario: No pending check hint when PENDING_CHECK chunk is absent
- **WHEN** the frontend receives `SUGGESTED_ACTION` chunks with no preceding `PENDING_CHECK` chunk
- **THEN** no pending check hint is shown above the action buttons
