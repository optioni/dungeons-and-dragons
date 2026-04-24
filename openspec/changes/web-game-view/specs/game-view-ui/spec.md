## MODIFIED Requirements

### Requirement: The transcript combines persisted history with live streamed output
The play UI SHALL render the conversation transcript from persisted `GameEvent`s and append in-progress DM output from `dmStream(sessionId)` without waiting for page reload. Once a streamed DM turn is finalized, the UI SHALL reconcile the optimistic in-progress message with the persisted transcript state. When the stream emits `INNER_VOICE` chunks, the play route SHALL render them as a visually distinct, character-owned transcript treatment separate from the DM narrative buffer. The route SHALL treat repeated terminal `DONE` chunks as idempotent once the session is already idle.

#### Scenario: Historical transcript is visible on page load
- **WHEN** the player opens a play route with existing session history
- **THEN** the transcript renders the previously persisted narrative and player-input events in chronological order

#### Scenario: Live DM output appears while streaming
- **WHEN** the subscription receives `NARRATIVE_CHUNK` payloads for the active session
- **THEN** the UI appends those chunks to the current in-progress DM message in the narrative column

#### Scenario: Finalized DM message replaces optimistic stream state
- **WHEN** the active turn emits its completion signal and the transcript query includes the persisted `DM_NARRATIVE` event
- **THEN** the UI replaces the temporary in-progress rendering with the finalized persisted message without duplicating the content

#### Scenario: Inner voice renders as a distinct transcript layer
- **WHEN** the subscription emits `INNER_VOICE` chunks after the main DM turn completes
- **THEN** the UI renders that text in a separate inner-voice treatment without merging it into the active DM narrative bubble

#### Scenario: Second DONE does not reset the transcript a second time
- **WHEN** the subscription emits a second terminal `DONE` chunk after the route is already idle
- **THEN** the UI ignores it without duplicating transcript state or reopening loading indicators

### Requirement: The play screen provides core narrative controls and state
The main gameplay view SHALL include:
- a narrative column for the transcript
- a character sidebar showing current character state required during play
- a text input and send action for player turns
- surfaced suggested actions when the active stream emits them

The route SHALL disable duplicate sends while a turn is already in progress for the active session. The route SHALL also disable the standard player input while a blocking play-state overlay such as level-up or spell preparation is open. When the player taps a suggested action chip, the route SHALL pre-fill the current text input with that action rather than auto-submitting it.

#### Scenario: Player can submit a turn from the play route
- **WHEN** the player enters non-empty text and submits it while no turn is in progress
- **THEN** the UI calls the player-input mutation and shows the submitted text in the transcript

#### Scenario: Send controls are disabled during an active turn
- **WHEN** the UI is still receiving stream output for the current turn
- **THEN** the text input and submit control prevent the player from starting a second overlapping turn

#### Scenario: Suggested actions appear as ephemeral UI hints
- **WHEN** the subscription emits a `SUGGESTED_ACTION` payload for the active DM message
- **THEN** the UI renders those action chips without requiring that they already exist in persisted transcript data

#### Scenario: Selecting a suggested action pre-fills the input
- **WHEN** the player taps a rendered suggested action chip
- **THEN** the route copies that action text into the player input field without immediately sending the turn

#### Scenario: Blocking overlays disable freeform input
- **WHEN** the play route shows a level-up or spell-preparation overlay
- **THEN** the standard text input and send control are disabled until that blocking flow resolves

## ADDED Requirements

### Requirement: The play route keeps transcript streaming separate from shell-state reconciliation
The play route SHALL treat transcript chunk rendering and play-shell state reconciliation as separate concerns. Post-turn transcript-only updates such as `INNER_VOICE` chunks SHALL NOT retrigger combat-panel layout changes, sidebar refresh loops, or scene-shell transitions unless the server also publishes a durable session-state change.

#### Scenario: Inner voice does not toggle combat layout
- **WHEN** `INNER_VOICE` chunks arrive after a completed combat turn and `GameSession.sceneType` remains unchanged
- **THEN** the transcript updates while the current shell layout remains stable

#### Scenario: Transcript-only chunks do not reopen blocking overlays
- **WHEN** a post-turn transcript chunk arrives without a new blocking `STATUS` signal
- **THEN** the play route leaves level-up, spell-preparation, and other shell overlays in their current state
