## MODIFIED Requirements

### Requirement: The play screen provides core narrative controls and state
The main gameplay view SHALL include:
- a narrative column for the transcript
- a character sidebar showing current character state required during play
- a text input and send action for player turns
- surfaced suggested actions when the active stream emits them

The route SHALL disable duplicate sends while a turn is already in progress for the active session. The route SHALL also disable the standard player input while a blocking play-state overlay such as level-up or spell preparation is open. When the player taps a suggested action chip, the route SHALL pre-fill the current text input with that action rather than auto-submitting it.

The play route SHALL also accept controlled travel requests initiated from the world map. When the world page confirms travel to a discovered location, the request SHALL be sent through the active session's player-input flow so the DM session can narrate and invoke the existing `travel_to` tool. The play UI SHALL process the resulting stream, tool results, encounters, quest auto-checks, transcript reconciliation, and state refreshes through the same path as any other player turn.

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

#### Scenario: Travel request from world map enters session flow
- **WHEN** the player confirms travel to a discovered location from the world map
- **THEN** the web app submits a controlled player input for the active session instead of calling `travel_to` directly from the browser

#### Scenario: Travel stream updates play state
- **WHEN** the DM session resolves a world-map travel request through the existing `travel_to` tool
- **THEN** the play route handles streamed narrative, tool results, encounter state, quest updates, transcript reconciliation, and durable state refreshes through the normal turn-completion flow
