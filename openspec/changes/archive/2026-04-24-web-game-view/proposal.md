## Why

The game view is the primary interface players interact with during play. While `session-and-llm` wires the backend SSE subscription and the narrative column, the full game view requires the combat panel (initiative tracker, action economy, quick actions, spell slots), the level-up panel, and the complete character sidebar — all responding to game state changes in real time.

## What Changes

- Combat panel component — slides in on `start_combat` SSE event, slides out on `end_combat`
  - Initiative order with HP bars for all combatants
  - Action / bonus action / reaction / movement economy tracker
  - Quick action buttons (Attack, Cast Spell, Dash, Dodge, Other)
  - Spell slot pips per level
- Level-up panel — appears on `trigger_level_up` SSE event, player selects new abilities, submits `apply_level_up`
- Character sidebar — HP bar, AC, level, conditions, spell slots (updated reactively via subscription chunks)
- Suggested action chips — rendered after each DM message, click to pre-fill input
- Death saving throw UI — shown when character is at 0 HP

## Capabilities

### New Capabilities
- `combat-ui`: Combat panel with full tracker, action economy, quick actions — slides in/out based on combat state
- `levelup-ui`: Level-up panel triggered by SSE event, ability selection, submission
- `death-ui`: Death saving throw display at 0 HP

### Modified Capabilities
- `game-view-ui`: Adds combat panel, level-up panel, death UI, and reactive character sidebar to the existing game view layout

## Impact

- All changes in `web/` only
- Depends on `session-and-llm` (SSE subscription), `game-engine` (combat/levelup tool events)
- No new API endpoints — all driven by existing `dmStream` subscription event types
