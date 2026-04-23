## MODIFIED Requirements

### Requirement: The play screen provides core narrative controls and state
The main gameplay view SHALL include:
- a narrative column for the transcript
- a character sidebar showing current character state required during play
- a text input and send action for player turns
- surfaced suggested actions when the active stream emits them

The route SHALL disable duplicate sends while a turn is already in progress for the active session. When the player taps a suggested action chip, the route SHALL pre-fill the current text input with that action rather than auto-submitting it.

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

### Requirement: The level-up panel opens when levelUpPending is true
The play route SHALL monitor the active DM stream for `STATUS` chunks with `status = "LEVEL_UP_PENDING"`. When that signal arrives, the route SHALL open a level-up panel overlay. The panel SHALL display the new level, hit die roll instructions, and available ability score improvements or feat choices. The player SHALL be able to submit their choices, which triggers the `apply_level_up` mutation. While the panel is open the standard player input SHALL be disabled.

#### Scenario: Level-up panel opens from stream status
- **WHEN** the active DM stream emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"`
- **THEN** the level-up panel overlay is displayed and the standard text input is disabled

#### Scenario: Submitting level-up choices closes the panel
- **WHEN** the player confirms their level-up selections and the `apply_level_up` mutation succeeds
- **THEN** the level-up panel is dismissed and the standard player input is re-enabled

#### Scenario: Level-up panel is not shown without the pending status
- **WHEN** the active play route has not received a `LEVEL_UP_PENDING` status chunk for the current flow
- **THEN** no level-up overlay is rendered

## ADDED Requirements

### Requirement: The spell-preparation modal opens when a SPELL_PREP_PENDING status chunk arrives
The play route SHALL monitor the active DM stream for `STATUS` chunks with `status = "SPELL_PREP_PENDING"`. When that signal arrives, the route SHALL freeze the standard player input and open the spell-preparation selection UI for the active character. After the player successfully submits the `prepareSpells` mutation, the route SHALL close the spell-preparation UI and re-enable text input.

#### Scenario: Spell-preparation UI opens from stream status
- **WHEN** the active DM stream emits a `STATUS` chunk with `status = "SPELL_PREP_PENDING"`
- **THEN** the spell-preparation modal or panel is displayed and the standard text input is disabled

#### Scenario: Successful spell preparation resumes freeform play
- **WHEN** the player submits spell choices and the `prepareSpells` mutation succeeds
- **THEN** the spell-preparation UI closes and the standard text input is re-enabled
