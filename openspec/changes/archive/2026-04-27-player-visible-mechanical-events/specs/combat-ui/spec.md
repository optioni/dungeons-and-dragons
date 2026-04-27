## ADDED Requirements

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
