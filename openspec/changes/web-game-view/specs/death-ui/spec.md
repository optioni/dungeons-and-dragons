## ADDED Requirements

### Requirement: The play route surfaces death-save state when the character is at 0 HP
The play route SHALL display dedicated death-save UI whenever the active character's durable play-state data indicates the character is at `0` HP and still in a recoverable dying state. The death-save presentation SHALL remain visually distinct from both DM narrative and combatant summaries so the player can immediately recognize the emergency state.

#### Scenario: Death-save UI appears at 0 HP
- **WHEN** the character's durable play-state data shows `hp = 0` and the character is not dead or stabilized
- **THEN** the play route renders the death-save UI

#### Scenario: Death-save UI stays hidden while conscious
- **WHEN** the character's HP is above 0
- **THEN** no death-save UI is rendered

### Requirement: The death-save UI shows current success and failure progress
The death-save UI SHALL present the character's current death-save progress, including successes and failures already recorded by the server, so the player can see how close the character is to stabilizing or dying. The UI SHALL update from durable server state after each resolved death-save outcome.

#### Scenario: Existing death-save counters are shown
- **WHEN** the player opens the play route while the character already has recorded death-save successes or failures
- **THEN** the death-save UI shows the current counts from server state

#### Scenario: Server-side death-save outcome refreshes the UI
- **WHEN** a completed turn changes the character's death-save success or failure count
- **THEN** the play route refreshes the death-save UI from updated durable state

### Requirement: The death-save UI coexists with the active play shell
The death-save UI SHALL integrate with the existing play shell without erasing transcript history or replacing the combat panel outright. If the character is dying during combat, the death-save UI SHALL remain visible alongside the combat-aware layout.

#### Scenario: Death-save UI preserves transcript visibility
- **WHEN** the character enters the dying state during play
- **THEN** the transcript remains visible while the death-save UI is shown

#### Scenario: Death-save UI can appear during combat
- **WHEN** the character is at 0 HP while `GameSession.sceneType = COMBAT`
- **THEN** the death-save UI is shown without removing the combat-aware play layout
