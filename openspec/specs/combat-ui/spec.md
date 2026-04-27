# Combat UI Spec

## Purpose

Defines the frontend combat panel — how it appears and disappears during scene transitions, how it displays initiative order and HP, how it tracks action economy, and how it provides quick action shortcuts and spell slot pips for spellcasters.

## Requirements

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

### Requirement: The combat panel displays the initiative order with HP bars
The `CombatPanel` SHALL display the combatant list in initiative order (highest to lowest). For each combatant it SHALL show: name, current HP, max HP as a progress bar, and the combatant's active conditions as badges. The currently active combatant (the one whose turn it is) SHALL be visually highlighted.

#### Scenario: Combatants appear in initiative order
- **WHEN** the combat panel is visible with an active CombatSession
- **THEN** combatants are listed from highest initiative to lowest

#### Scenario: Active combatant is highlighted
- **WHEN** the initiative advances to a new combatant
- **THEN** only that combatant's row is highlighted; all others are in the default state

#### Scenario: HP bar reflects current HP proportion
- **WHEN** a combatant's current HP is 8 out of 20 max HP
- **THEN** the HP progress bar fills to 40% and the numeric values `8 / 20` are displayed

#### Scenario: Active conditions appear as badges on each combatant
- **WHEN** a combatant has conditions such as POISONED and PRONE
- **THEN** each condition is displayed as a badge on that combatant's row

### Requirement: The combat panel tracks action economy for the player's turn
The `CombatPanel` SHALL display the player character's action economy state for the current turn: one **Action**, one **Bonus Action**, one **Reaction**, and movement distance. Each slot SHALL be shown as used or available based on data from the active `CombatSession.combatants` entry for the character.

#### Scenario: All actions available at start of player's turn
- **WHEN** the initiative advances to the player character and all action economy flags are reset
- **THEN** Action, Bonus Action, Reaction, and movement are all displayed as available

#### Scenario: Used action is shown as spent
- **WHEN** `CombatSession.combatants[character].usedAction` is true
- **THEN** the Action slot is rendered in a spent/dimmed state

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

### Requirement: The combat panel displays spell slot pips for spellcasters
The `CombatPanel` SHALL display spell slot availability as pips (filled = available, empty = used) when the player character has any spell slots. Slots are grouped by level. Non-spellcasting characters SHALL not see this section.

#### Scenario: Spellcaster sees spell slot pips grouped by level
- **WHEN** the combat panel is visible and the character has spell slots at levels 1 and 2
- **THEN** two groups of pips are shown, one per level, with filled pips for available and empty for used slots

#### Scenario: Non-spellcaster sees no spell slot pips
- **WHEN** the character has an empty `spellSlots` array
- **THEN** the spell slot section is not rendered in the combat panel

### Requirement: Combat panel surfaces combat visible events
The combat panel SHALL be the primary player-facing surface for `PLAYER_VISIBLE_EVENT` records with category `COMBAT`. The panel SHALL render recent combat events as a compact feed or affected-combatant treatment showing observed damage, healing, condition changes, death save outcomes, combat start, and combat end without cluttering the central narrative transcript.

#### Scenario: Damage event appears in combat panel
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `COMBAT` and kind `DAMAGE_APPLIED` is available for the active combat
- **THEN** the combat panel shows the affected combatant and observed damage amount in a compact combat event treatment

#### Scenario: Condition event appears in combat panel
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `COMBAT` and kind `CONDITION_APPLIED` or `CONDITION_REMOVED` is available
- **THEN** the combat panel shows the affected combatant and condition change without exposing hidden enemy statistics

#### Scenario: Major combat milestone may appear in transcript
- **WHEN** a combat visible event represents combat start, combat end, death save outcome, or character death
- **THEN** the UI may also render a restrained transcript milestone while routine damage and condition events remain primarily in the combat panel

### Requirement: Combat event feed uses dense grimoire styling
The combat panel SHALL render combat events as dense rows, not cards. The feed SHALL use Cinzel micro-labels, muted grimoire text for routine events, mono text for numeric values, and sparse gold accent for current-turn or player-owned events.

#### Scenario: Combat feed does not use card-heavy treatment
- **WHEN** several combat visible events are shown in the combat panel
- **THEN** they render as compact rows that preserve space for initiative, HP, conditions, actions, and spell slots
