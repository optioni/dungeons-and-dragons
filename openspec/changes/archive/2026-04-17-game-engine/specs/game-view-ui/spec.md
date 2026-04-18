## MODIFIED Requirements

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

## ADDED Requirements

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
