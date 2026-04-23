## Context

The app has `SceneType` (EXPLORATION | COMBAT | SOCIAL | SETTLEMENT | REST) defined in `session.enums.ts`, with a corresponding prompt module text file per scene type loaded by `PromptModuleRegistry`. `Location` is a world-scale entity with `connectedLocationIds`, `currentState`, and coordinate fields. `GameSession` tracks the active scene. `Map` already has a `scale = DUNGEON` value but no structural model backs it. `ItemService.giveItem` and `CombatService.startCombat` (participants by NPC id) are the integration points for loot and encounters respectively.

No dungeon, room, or keyed-encounter entities exist. The `EXPLORATION` prompt module currently handles dungeon play as a flat narrative with no persistent room state.

## Goals / Non-Goals

**Goals:**
- `DUNGEON` scene type with a `dungeon.txt` prompt module
- `Dungeon` entity as a first-class world object independent of quests
- Rooms modelled as `Location` rows with `dungeonId`, `floor`, and `roomState` fields
- `RoomEncounter` entity for pre-stocked keyed encounters per room
- Wandering monster table stored as JSON on `Dungeon`, rolled by `move_to_room`
- `RoomItem` entity for pre-placed treasure with optional container name
- `activeDungeonId` on `GameSession` persisting through `COMBAT` scene detours
- Eight new LLM tools: `create_dungeon`, `enter_dungeon`, `move_to_room`, `spawn_encounter`, `update_room_state`, `add_room_item`, `loot_room`, `exit_dungeon`
- `QuestEntity.entityType` gains `DUNGEON`; `create_quest` accepts optional `dungeonId` reference
- GraphQL relay-paginated queries for dungeons and room encounters

**Non-Goals:**
- Procedural dungeon generation (DM designs all rooms explicitly)
- Multi-level dungeon navigation UI in web (no dungeon map renderer in this change)
- Trap mechanics beyond `roomState = TRAPPED` (no damage-on-entry automation)
- Darkness / torch resource tracking (handled narratively by the DM module)
- Dungeon reset / respawn mechanics

## Decisions

### 1. Rooms are `Location` rows, not a separate entity

`Location` already models discrete places with `connectedLocationIds` for adjacency. Adding `dungeonId` (FK, nullable), `floor` (int, nullable), and `roomState` (enum, nullable) turns rooms into a scoped subset of `Location` — no new entity needed. The existing `Map(scale=DUNGEON)` + `MapLocation` + `LocationDiscovery` infrastructure works unmodified. `travel_to` remains the world-scale navigation tool; `move_to_room` is the dungeon-scoped equivalent.

**Alternative considered:** Separate `DungeonRoom` entity. Rejected because it duplicates the Location graph, breaks `LocationDiscovery`, and requires a parallel map rendering path.

### 2. `activeDungeonId` on `GameSession` — nullable FK

When the DM calls `enter_dungeon`, `GameSession.activeDungeonId` is set. It persists when `sceneType` switches to `COMBAT` (enemy encounter) and back to `DUNGEON` after combat ends. `exit_dungeon` clears it. All dungeon-scoped tools (`move_to_room`, `spawn_encounter`, etc.) reject calls when `activeDungeonId` is null.

**Why:** Keeps dungeon context alive through combat without a separate state machine. The session is the single source of truth for "where the player is."

### 3. `DungeonModule` owns dungeon entities; tools registered via `GameEngineModule`

A new `DungeonModule` owns `Dungeon`, `RoomEncounter`, `RoomItem` entities, `DungeonResolver`, and `DungeonService`. Tool handlers (`EnterDungeonHandler`, `MoveToRoomHandler`, etc.) live in `GameEngineModule` and are registered via `GameEngineToolRegistrar`, importing `DungeonService` from `DungeonModule`. This mirrors the pattern where `WorldMutationService` lives in `GameEngineModule` but `WorldModule` owns world entities.

**Alternative considered:** Put all dungeon tools inside `DungeonModule`. Rejected because tool registration is centralized in `GameEngineToolRegistrar` and splitting it would require a second registrar.

### 4. `spawn_encounter` lazily materializes NPCs from `RoomEncounter.monsters` spec

`RoomEncounter.monsters` stores a JSON array of specs: `[{ srdIndex?: string, name: string, count: number, hp?: number }]`. When the DM calls `spawn_encounter(roomId)`, `DungeonService` creates `Npc` entities from these specs (using SRD stat blocks when `srdIndex` is provided, falling back to `hp` if given, otherwise defaults). The returned `npcIds` are ready for `start_combat`. On `spawn_encounter(dungeonId, fromTable: true)` the service picks a weighted entry from `Dungeon.encounterTable` and materializes the same way.

**Why:** Creating all NPCs at `create_dungeon` time wastes rows for rooms the player never reaches. Lazy materialization keeps the database clean and lets the DM pre-stock encounters without committing NPC rows until they're needed.

**Alternative considered:** Eager NPC creation at dungeon creation time. Rejected due to wasted rows and orphaned NPC entities for cleared rooms.

### 5. `RoomItem` mirrors `NpcItem` — no Container entity

`RoomItem` has `roomId`, `itemId`, `quantity`, and `containerName (nullable string)`. `containerName` is narrative flavour ("iron chest", "rotting barrel") — no separate Container entity. The DM decides when to trigger `loot_room` based on player action; `loot_room` calls `ItemService.giveItem` internally and removes the `RoomItem` row.

**Why:** A Container entity adds a join layer without behavioural benefit. The DM controls the narrative timing of looting; the server just needs to know what items are in the room and remove them when taken.

### 6. `move_to_room` validates adjacency and rolls the wandering monster die

`move_to_room(roomId)` checks that the target room's id appears in the current room's `connectedLocationIds`. If `Dungeon.encounterTable` is non-null, it rolls a d6 — on a 1 it returns a `wanderingMonsterTriggered: true` flag in `ToolResult` so the DM can narrate an ambush and call `spawn_encounter`. The room transitions from `UNEXPLORED` to `EXPLORED` on first entry.

**Why:** Keeping the roll server-side ensures consistent mechanics. Returning it as a flag (not auto-starting combat) keeps the DM in narrative control — same philosophy as the quest auto-checker signalling the LLM rather than auto-completing.

### 7. Quest integration via `QuestEntity.entityType = DUNGEON` and optional `dungeonId` on `create_quest`

`QuestEntity` gains `DUNGEON` as an entity type. `create_quest` accepts an optional `dungeonId` — when provided, a `QuestEntity(type=DUNGEON, entityId=dungeonId)` is created in the same transaction. Pre-placed `RoomItem` items support `HAVE_ITEM` objectives: the auto-checker fires when `loot_room` calls `giveItem`, which already emits `STATE_CHANGED_EVENT`.

**Alternative considered:** Auto-scaffolding a dungeon inside `create_quest` from a `dungeonSpec` parameter. Rejected because dungeons exist independently of quests and the DM should create them with `create_dungeon` first — keeping tool responsibilities single-purpose.

## Risks / Trade-offs

- **`Location` table mixing world and room rows** → Mitigated by `dungeonId IS NOT NULL` as a discriminator; GraphQL resolvers for dungeon rooms always scope queries to `dungeonId`. World-scale location queries filter `dungeonId IS NULL`.
- **Wandering monster roll on every `move_to_room`** → One extra random roll per navigation step. No DB query — roll is in-process. Negligible latency.
- **Lazy NPC materialization creates rows mid-session** → Same pattern as `create_item` during play. MikroORM identity map batches inserts. The DM calling `spawn_encounter` is an explicit action — no surprise side effects.
- **`RoomEncounter.monsters` JSON has no FK integrity** → SRD monster indexes are validated against the Redis-cached SRD at `spawn_encounter` time. Invalid indexes return a structured error the LLM can recover from.
- **`activeDungeonId` could become stale if session crashes mid-dungeon** → On session resume, `activeDungeonId` is non-null; `sceneType` is `DUNGEON`. The DM can call `exit_dungeon` to reset. No data loss.

## Migration Plan

1. Add `dungeon` table: `id`, `campaignId`, `name`, `description`, `totalFloors`, `encounterTable (jsonb nullable)`
2. Add columns to `location`: `dungeon_id (FK nullable)`, `floor (int nullable)`, `room_state (varchar nullable)`
3. Add `room_encounter` table: `id`, `room_id (FK → location)`, `description`, `cleared (bool)`, `monsters (jsonb)`
4. Add `room_item` table: `room_id (FK → location)`, `item_id (FK → item)`, `quantity`, `container_name (varchar nullable)`
5. Add `active_dungeon_id (FK nullable)` to `game_session`
6. Extend `quest_entity_type` enum with `DUNGEON`
7. Rollback: drop new tables, drop added columns, revert enum

No data migration required — all additions are nullable or new tables.

## Open Questions

- Should `roomState = TRAPPED` be visible to the player (known trap) or hidden (unknown)? Proposed: `roomState` is server-visible only; the DM describes traps narratively. A `trapKnown` boolean can be added later if needed.
- Should `spawn_encounter` for wandering monsters create a `RoomEncounter` row (for cleared-state tracking) or just return npcIds ephemerally? Proposed: ephemeral — wandering monsters don't mark a room cleared, only keyed encounters do.
