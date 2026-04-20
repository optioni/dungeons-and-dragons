## Why

`travel_to` is documented as "validates location is discovered, moves player, advances in-game time, may trigger random encounter" but the `TravelService` only moves the player — there is no encounter roll, no monster lookup, and no combat trigger. Wilderness travel without any danger risk removes a foundational pillar of the D&D experience.

## What Changes

- `travel_to` extended with a post-move encounter roll: `d20 + location danger modifier`. Location danger is derived from `Location.currentState` (SAFE = +0, TENSE = +2, THREATENED = +4, HOSTILE = +6, RUINED = +3). Roll ≥ 15 triggers a random encounter.
- On encounter trigger, `TravelService` draws 1-3 monsters from `SrdMonster` filtered by challenge rating appropriate to the character's level (CR = floor(characterLevel / 2) ± 1). Draws are random, weighted by CR proximity.
- After drawing monsters, `TravelService` calls the `start_combat` tool handler directly, materialising the monsters as temporary `Npc` entities (alive: true, hp/maxHp set from SrdMonster, agenda: null, not persisted beyond the combat).
- The tool result returned to the LLM includes the encounter description ("A pair of goblins ambushes you on the road") so it can narrate the surprise naturally.
- `Campaign` gains `travelEncounterEnabled: boolean` (default true) — can be disabled by the LLM via `update_campaign_settings` for safe travel sequences (e.g. after a story milestone where the road is cleared).
- Long rests and short rests do not trigger encounters.

## Capabilities

### New Capabilities
- `random-encounter-roll`: Post-travel d20 roll with location-state danger modifier; encounter threshold 15+.
- `encounter-monster-draw`: SrdMonster draw by CR bracket matching character level; 1-3 monsters per encounter.
- `encounter-combat-start`: Materialises drawn monsters as temporary Npc entities, calls `start_combat` handler.
- `travel-encounter-toggle`: `Campaign.travelEncounterEnabled` flag; `update_campaign_settings` tool to toggle it.

### Modified Capabilities
- `game-engine` / `travel_to`: Post-move encounter roll added; result includes encounter description in tool output.
- `combat.service`: `start_combat` called from `TravelService` (existing combat start path, new call site).

## Impact

- `TravelService` — encounter roll logic, monster draw query, combat start call
- `Campaign` entity — `travelEncounterEnabled: boolean default true`; MikroORM migration required
- `GameEngineModule` — `update_campaign_settings` tool for toggling encounter flag (and potentially other future campaign-level settings)
- `SrdMonster` repository — CR-filtered random draw query
- Depends on `game-engine`, `world-system`, `srd-seed`
