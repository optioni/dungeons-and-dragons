# Game View UI Spec

## Purpose

Defines the gameplay frontend — the play route, transcript rendering combining persisted history with live streaming, the player input controls, the character sidebar, scene-aware UI, and stream interruption resilience.

## Requirements

### Requirement: The play route loads or resumes campaign play state
The web application SHALL provide a main gameplay route at `/campaign/[id]/play`. On load, the route SHALL fetch the owned campaign, resolve or create the active `GameSession`, and load the persisted transcript before attaching to the live DM stream.

#### Scenario: Play route resumes an existing active session
- **WHEN** the player opens `/campaign/[id]/play` for a campaign that already has an active session
- **THEN** the page loads that session's persisted `GameEvent` history and subscribes to its `dmStream`

#### Scenario: Play route starts the first session
- **WHEN** the player opens `/campaign/[id]/play` for a ready-to-play campaign with no active session
- **THEN** the UI starts or prompts to start a session and renders the initial opening narrative returned from `startSession`

### Requirement: The transcript combines persisted history with live streamed output
The play UI SHALL render the conversation transcript from persisted `GameEvent`s and append in-progress DM output from `dmStream(sessionId)` without waiting for page reload. Once a streamed DM turn is finalized, the UI SHALL reconcile the optimistic in-progress message with the persisted transcript state.

#### Scenario: Historical transcript is visible on page load
- **WHEN** the player opens a play route with existing session history
- **THEN** the transcript renders the previously persisted narrative and player-input events in chronological order

#### Scenario: Live DM output appears while streaming
- **WHEN** the subscription receives `NARRATIVE_CHUNK` payloads for the active session
- **THEN** the UI appends those chunks to the current in-progress DM message in the narrative column

#### Scenario: Finalized DM message replaces optimistic stream state
- **WHEN** the active turn emits its completion signal and the transcript query includes the persisted `DM_NARRATIVE` event
- **THEN** the UI replaces the temporary in-progress rendering with the finalized persisted message without duplicating the content

### Requirement: The play screen provides core narrative controls and state
The main gameplay view SHALL include:
- a narrative column for the transcript
- a character sidebar showing current character state required during play
- a text input and send action for player turns
- surfaced suggested actions when the active stream emits them

The route SHALL disable duplicate sends while a turn is already in progress for the active session.

#### Scenario: Player can submit a turn from the play route
- **WHEN** the player enters non-empty text and submits it while no turn is in progress
- **THEN** the UI calls the player-input mutation and shows the submitted text in the transcript

#### Scenario: Send controls are disabled during an active turn
- **WHEN** the UI is still receiving stream output for the current turn
- **THEN** the text input and submit control prevent the player from starting a second overlapping turn

#### Scenario: Suggested actions appear as ephemeral UI hints
- **WHEN** the subscription emits a `SUGGESTED_ACTION` payload for the active DM message
- **THEN** the UI renders those action chips without requiring that they already exist in persisted transcript data

### Requirement: The character sidebar reflects durable gameplay state
The play route SHALL render a sidebar containing at least the character's name, HP, max HP, AC, level, active conditions, and spell-slot summary when applicable. The sidebar SHALL update from durable server state rather than inferring long-lived character state from narrative text.

#### Scenario: Sidebar shows current mechanical state on load
- **WHEN** the play route loads for a campaign with a character
- **THEN** the sidebar displays the latest persisted character state returned by GraphQL

#### Scenario: Sidebar reflects server-side state changes after a turn
- **WHEN** a completed turn changes character conditions, HP, or spell-slot usage through tool execution
- **THEN** the play route refreshes or reconciles the sidebar from updated server data

### Requirement: Scene-aware UI responds to durable session state
The play route SHALL derive scene-specific UI from the durable `GameSession.sceneType` value. The initial release SHALL support narrative mode by default. When `sceneType = COMBAT`, the play layout SHALL make space for the `CombatPanel` component on the left side without collapsing the narrative column. The layout SHALL react to scene changes published during the active stream.

#### Scenario: Initial session renders narrative mode
- **WHEN** the active session has `sceneType = EXPLORATION`
- **THEN** the route renders the default narrative-first layout with no combat panel

#### Scenario: Scene transition to COMBAT expands the layout for the combat panel
- **WHEN** the active session's `sceneType` changes to COMBAT during a streamed turn
- **THEN** the play layout adjusts to accommodate the combat panel on the left while keeping the narrative column visible

#### Scenario: Scene transition away from COMBAT restores the default layout
- **WHEN** the active session's `sceneType` changes from COMBAT to any other value
- **THEN** the play layout removes the combat panel space and returns to the standard narrative layout

#### Scenario: Scene transition updates the play shell
- **WHEN** the active session's `sceneType` changes during a streamed turn
- **THEN** the UI updates its scene-aware presentation based on the new durable session state instead of parsing the narrative text

### Requirement: Stream interruptions do not erase play history
The play route SHALL tolerate SSE interruption by reconnecting to the active session stream and preserving already-rendered persisted transcript history. The UI SHALL de-duplicate repeated stream chunks after reconnect.

#### Scenario: Refresh resumes from persisted transcript
- **WHEN** the player refreshes `/campaign/[id]/play` during or after an earlier turn
- **THEN** the page reloads the persisted session transcript and does not depend on client-only memory to reconstruct prior history

#### Scenario: Reconnect does not duplicate visible chunks
- **WHEN** the SSE connection reconnects and the server replays or re-delivers chunk payloads
- **THEN** the client ignores duplicates using the stream sequencing data for that session

### Requirement: The level-up panel opens when levelUpPending is true
The play route SHALL monitor `GameSession.levelUpPending`. When the value transitions to true (detected via subscription or post-turn query), the route SHALL open a level-up panel overlay. The panel SHALL display the new level, hit die roll instructions, and available ability score improvements or feat choices. The player SHALL be able to submit their choices, which triggers the `apply_level_up` mutation. While the panel is open the standard player input SHALL be disabled.

#### Scenario: Level-up panel opens when levelUpPending becomes true
- **WHEN** the active session's `levelUpPending` transitions to true after a turn
- **THEN** the level-up panel overlay is displayed and the standard text input is disabled

#### Scenario: Submitting level-up choices closes the panel
- **WHEN** the player confirms their level-up selections and the `apply_level_up` mutation succeeds
- **THEN** the level-up panel is dismissed and the standard player input is re-enabled

#### Scenario: Level-up panel is not shown when levelUpPending is false
- **WHEN** the active session has `levelUpPending = false`
- **THEN** no level-up overlay is rendered
