## MODIFIED Requirements

### Requirement: A combat panel slides in when combat begins and out when it ends
The web application SHALL render a `CombatPanel` component only when the active `GameSession.sceneType = COMBAT` and durable session data includes a non-null `combatSession` payload. The panel SHALL slide in from the left of the play layout when combat starts and slide out when the durable session state returns to a non-combat value or no active combat session remains. The panel SHALL NOT block or replace the central narrative column.

#### Scenario: Combat panel is hidden in non-combat scenes
- **WHEN** the active session has `sceneType = EXPLORATION`
- **THEN** the combat panel is not rendered in the play layout

#### Scenario: Combat panel stays hidden without a combat session payload
- **WHEN** the active session has `sceneType = COMBAT` but `combatSession` is null
- **THEN** the combat panel is not rendered until durable combat-session data is available

#### Scenario: Combat panel slides in when combat session becomes available
- **WHEN** the active session's `sceneType` changes to COMBAT and the route has a non-null `combatSession`
- **THEN** the combat panel animates in from the left without covering the narrative column

#### Scenario: Combat panel slides out when combat ends
- **WHEN** the active session's `sceneType` changes away from COMBAT
- **THEN** the combat panel animates out and is removed from the layout

### Requirement: The combat panel provides quick action buttons
The `CombatPanel` SHALL render quick action buttons — Attack, Cast Spell, Dash, Dodge, and Other — below the initiative list. Clicking a quick action SHALL pre-fill the player text input with a suggested action prompt but SHALL NOT auto-submit the turn. The buttons SHALL be disabled while a DM turn is in progress.

#### Scenario: Attack quick action pre-fills the player input
- **WHEN** the player clicks the Attack quick action button
- **THEN** the text input is populated with an attack action prompt and the turn remains unsubmitted

#### Scenario: Other quick action creates an open-ended prompt
- **WHEN** the player clicks the Other quick action button
- **THEN** the text input is populated with an open-ended action prompt the player can finish editing before sending

#### Scenario: Quick action buttons are disabled during an active DM turn
- **WHEN** the DM stream is actively receiving chunks
- **THEN** all quick action buttons are in a disabled state
