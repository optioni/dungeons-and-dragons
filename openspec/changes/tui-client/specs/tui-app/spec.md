## ADDED Requirements

### Requirement: TUI app renders a full play experience in the terminal
The system SHALL provide an `apps/tui/` package built with Ink (React/TypeScript) that connects to the same GraphQL/SSE API as the web client and offers a complete play and setup experience. The TUI SHALL require a minimum terminal width of 120 columns and SHALL render a degraded single-column layout when the terminal is narrower.

#### Scenario: TUI starts within a wide enough terminal
- **WHEN** the user runs the TUI in a terminal with >= 120 columns
- **THEN** the app renders a two-column layout: narrative panel on the left and character/combat sidebar on the right

#### Scenario: TUI degrades gracefully in narrow terminals
- **WHEN** the user runs the TUI in a terminal narrower than 120 columns
- **THEN** the app renders a single-column layout hiding the sidebar without crashing

### Requirement: TUI narrative panel streams DM output token by token
The narrative panel SHALL subscribe to `dmStream(sessionId)` via SSE and append `NARRATIVE_CHUNK` payloads to the visible buffer in real time. The buffer SHALL be capped at a maximum number of visible lines; older content is scrolled out but accessible via the diary view.

#### Scenario: Streaming narrative appends tokens as they arrive
- **WHEN** the DM is generating a response and `NARRATIVE_CHUNK` events arrive
- **THEN** each chunk is appended to the current in-progress message in the narrative panel without waiting for the full turn to complete

#### Scenario: Narrative buffer caps to prevent sluggish re-renders
- **WHEN** the session narrative exceeds the buffer cap
- **THEN** the oldest lines are removed from the visible buffer and the layout remains responsive

### Requirement: TUI accepts player input from the terminal
The TUI SHALL render a persistent input line at the bottom of the screen. Submitting a non-empty line SHALL call the `sendPlayerInput` mutation. The input field SHALL be disabled while a DM turn is in progress and re-enabled on stream completion.

#### Scenario: Player submits input via the input line
- **WHEN** the player types text and presses Enter on the input line
- **THEN** the TUI calls `sendPlayerInput` and disables the input field until the DM stream completes

#### Scenario: Empty input is not submitted
- **WHEN** the player presses Enter with an empty or whitespace-only input field
- **THEN** no mutation is called and the input field remains active

#### Scenario: Input field is locked during DM turn
- **WHEN** a DM stream is in progress
- **THEN** the input field is visually disabled and keypresses are ignored

### Requirement: TUI sidebar shows character sheet snapshot
The sidebar SHALL display the character's current HP, AC, level, class, and active conditions. This data SHALL be refreshed after each DM turn completes by re-querying the character state.

#### Scenario: Sidebar reflects post-turn character state
- **WHEN** a DM turn that includes a damage or heal tool call completes
- **THEN** the sidebar HP value is updated to reflect the new value without requiring a manual refresh

### Requirement: TUI displays suggested actions as selectable options
When a `SUGGESTED_ACTION` chunk arrives on the stream, the TUI SHALL render the suggested options above the input line. Selecting an option SHALL populate the input field with that action text, which the player can edit before submitting.

#### Scenario: Suggested actions appear after DM turn
- **WHEN** the DM stream emits `SUGGESTED_ACTION` chunks
- **THEN** the suggestions are rendered as numbered options above the input line

#### Scenario: Selecting a suggestion pre-fills the input field
- **WHEN** the player selects one of the numbered options
- **THEN** the input field is populated with the suggestion text and the player can edit or submit it

### Requirement: TUI exposes a diary/quest log view
The TUI SHALL provide a keyboard-toggled view that shows the last 20 diary entries and the current active quests with their objectives. This view SHALL replace the narrative panel when open and return to the narrative panel when closed.

#### Scenario: Player opens the diary view
- **WHEN** the player presses the diary toggle key
- **THEN** the narrative panel is replaced by the diary/quest log view showing recent entries and active quests

#### Scenario: Player closes the diary view
- **WHEN** the player presses the diary toggle key again
- **THEN** the diary view is dismissed and the narrative panel is restored

### Requirement: TUI handles reconnection transparently
If the SSE connection drops mid-session, the TUI SHALL attempt to reconnect using exponential backoff and SHALL surface a status indicator to the player. Upon successful reconnect the TUI SHALL resume the stream and de-duplicate any already-rendered chunks.

#### Scenario: SSE drop triggers reconnect attempt
- **WHEN** the SSE connection is lost during a DM stream
- **THEN** the TUI displays a reconnecting indicator and begins exponential backoff reconnection

#### Scenario: Reconnected stream de-duplicates chunks
- **WHEN** the TUI reconnects and the server re-delivers chunks already rendered
- **THEN** duplicate chunks are discarded and the narrative panel is not corrupted
