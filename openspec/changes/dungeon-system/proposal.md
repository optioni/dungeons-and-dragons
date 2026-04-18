## Why

Dungeons are a core D&D experience — discrete, designed spaces with rooms, encounters, traps, and treasure — but the current system only has `EXPLORATION` as a flat scene type with no structural model. Dungeons need their own scene type, persistent room state, pre-stocked encounters, and pre-placed loot so a cleared dungeon stays cleared.

## What Changes

- New `DUNGEON` scene type with a dedicated `dungeon.txt` prompt module
- `Dungeon` entity — first-class world object, created independently of quests
- `Location` gains `dungeonId`, `floor`, and `roomState` fields (rooms are locations at dungeon scale)
- `RoomEncounter` entity — pre-stocked keyed encounters per room; cleared state persists
- `RoomItem` entity — pre-placed treasure/loot attached to rooms, with optional container name
- `GameSession` gains `activeDungeonId` — persists through `COMBAT` scene detours
- LLM tools: `create_dungeon`, `enter_dungeon`, `move_to_room`, `spawn_encounter`, `update_room_state`, `add_room_item`, `loot_room`, `exit_dungeon`
- `QuestEntity` gains `DUNGEON` entity type so quests can reference dungeons
- Dungeon-level wandering monster encounter table (JSON on `Dungeon`) rolled by `move_to_room`

## Capabilities

### New Capabilities
- `dungeon-entities`: `Dungeon`, `RoomEncounter`, `RoomItem` entities, `dungeonId`/`floor`/`roomState` on `Location`, `activeDungeonId` on `GameSession`, GraphQL types and relay-paginated queries
- `dungeon-navigation`: `enter_dungeon`, `move_to_room`, `exit_dungeon` tools; scene flow `DUNGEON ↔ COMBAT` with `activeDungeonId` persisting through scene changes
- `dungeon-encounters`: `RoomEncounter` pre-stocked keyed encounters, dungeon-level wandering monster table, `spawn_encounter` tool that materializes `Npc` entities from specs for use with `start_combat`
- `dungeon-loot`: `RoomItem` pre-placed treasure, `add_room_item` and `loot_room` tools, `HAVE_ITEM` quest objective support via pre-placed items
- `dungeon-room-state`: `update_room_state` tool; `UNEXPLORED → EXPLORED → CLEARED` lifecycle; `LOCKED` and `TRAPPED` states; room state feeds quest auto-checker

### Modified Capabilities
- `game-session`: `activeDungeonId` field added to `GameSession`; `DUNGEON` added to `SceneType` enum
- `quest-entities`: `QuestEntity.entityType` gains `DUNGEON` value; `create_quest` accepts optional `dungeonId` reference

## Impact

- `session.enums.ts` — `SceneType` gains `DUNGEON`
- `prompt-module-registry.service.ts` — new `dungeon.txt` module entry
- `Location` entity — nullable `dungeonId`, `floor`, `roomState` fields; new migration
- `GameSession` entity — nullable `activeDungeonId` FK; new migration
- New `DungeonModule` owning `Dungeon`, `RoomEncounter`, `RoomItem` entities, resolver, and tool handlers
- `GameEngineModule` — new tool handlers registered via `GameEngineToolRegistrar`
- `QuestModule` — `QuestEntity.entityType` enum extended
- Depends on: `game-session`, `quest-entities`, `world-entities` (Location, Npc, Item)
