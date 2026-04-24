# Level-Up UI Spec

## Purpose

Defines the level-up overlay — when it opens, what choices it collects from the player, and how submitting those choices resolves the blocking play state and re-enables normal input.

## Requirements

### Requirement: The level-up overlay opens from durable pending state
The play route SHALL render a blocking level-up overlay whenever the active session indicates `levelUpPending = true` or the active DM stream emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"`. While the overlay is open, the standard player input SHALL remain disabled until the level-up flow is completed or dismissed by a successful server reconciliation.

#### Scenario: Level-up overlay opens from stream status
- **WHEN** the active DM stream emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"`
- **THEN** the play route displays the level-up overlay and disables the normal text input

#### Scenario: Level-up overlay opens from queried session state
- **WHEN** the play route loads an active session whose durable `levelUpPending` flag is true
- **THEN** the level-up overlay is shown immediately without waiting for a new stream chunk

### Requirement: The level-up overlay collects hit point gain and advancement choices
The level-up overlay SHALL display the target new level, collect the player's rolled hit point gain, and provide the advancement choices required for that level. For ability-score-improvement levels, the overlay SHALL let the player choose either ability score increases or a feat before submitting the mutation.

#### Scenario: Hit point roll entry is required
- **WHEN** the player opens the level-up overlay
- **THEN** the UI shows a hit-point-gain input and prevents submission until a valid positive roll is entered

#### Scenario: ASI levels offer ability scores or feat
- **WHEN** the character reaches a level that grants an ability score improvement
- **THEN** the overlay offers a choice between assigning ability-score points and entering a feat selection

#### Scenario: Non-ASI levels omit feat-or-ASI controls
- **WHEN** the character reaches a level that does not grant an ability score improvement
- **THEN** the overlay does not render the feat-or-ASI selection controls

### Requirement: Submitting level-up choices resolves the blocking state
The play route SHALL submit level-up selections through the `apply_level_up` mutation. On success, the overlay SHALL close and the standard player input SHALL be re-enabled. On failure, the overlay SHALL stay open and surface the returned error to the player.

#### Scenario: Successful level-up closes the overlay
- **WHEN** the player submits valid level-up selections and the `apply_level_up` mutation succeeds
- **THEN** the overlay is dismissed and the standard player input becomes available again

#### Scenario: Failed level-up keeps the overlay open
- **WHEN** the player submits level-up selections and the mutation returns an error
- **THEN** the overlay remains visible and displays the error without clearing the player's in-progress choices
