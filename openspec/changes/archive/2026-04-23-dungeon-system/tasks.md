## 1. Database Migration

- [x] 1.1 Create `dungeon` table: `id`, `campaignId` (FK), `name`, `description`, `totalFloors` (int, default 1), `encounterTable` (jsonb nullable)
- [x] 1.2 Add `dungeon_id` (FK nullable), `floor` (int nullable), `room_state` (varchar nullable, default `UNEXPLORED`) to `location` table
- [x] 1.3 Create `room_encounter` table: `id`, `room_id` (FK → location), `description`, `cleared` (bool, default false), `monsters` (jsonb)
- [x] 1.4 Create `room_item` table: `room_id` (FK → location), `item_id` (FK → item), `quantity` (int, default 1), `container_name` (varchar nullable)
- [x] 1.5 Add `active_dungeon_id` (FK → dungeon, nullable) to `game_session` table
- [x] 1.6 Extend `quest_entity_type` enum with `DUNGEON` value
- [x] 1.7 Run migration and verify schema with snapshot update

## 2. Session Enums and Scene Module

- [x] 2.1 Add `DUNGEON = 'DUNGEON'` to `SceneType` enum in `session.enums.ts`
- [x] 2.2 Create `apps/api/src/llm/prompt-modules/dungeon.txt` with room pacing, darkness, wandering die, trap/secret door, and key/lock guidance
- [x] 2.3 Add `dungeon.txt` entry to `SCENE_FILES` map in `prompt-module-registry.service.ts`

## 3. DungeonModule Entities

- [x] 3.1 Create `Dungeon` MikroORM entity with all fields and `@OneToMany` to Location rooms
- [x] 3.2 Create `RoomEncounter` MikroORM entity with `@ManyToOne` to Location
- [x] 3.3 Create `RoomItem` MikroORM entity with `@ManyToOne` to Location and Item
- [x] 3.4 Add `dungeonId`, `floor`, `roomState` fields to `Location` entity
- [x] 3.5 Add `activeDungeonId` FK field to `GameSession` entity

## 4. DungeonModule Setup

- [x] 4.1 Create `DungeonModule` with `DungeonService` and `DungeonResolver`
- [x] 4.2 Implement `DungeonService` with methods: `createDungeon`, `findByRoom`, `findActiveDungeon`, `addRoomItem`, `removeRoomItem`, `updateRoomState`, `spawnEncounter`
- [x] 4.3 Register `DungeonModule` in `AppModule`; export `DungeonService` for `GameEngineModule` to import

## 5. GraphQL Types and Queries

- [x] 5.1 Create `Dungeon` GraphQL object type with relay `DungeonConnection`
- [x] 5.2 Create `RoomEncounter` GraphQL object type
- [x] 5.3 Create `RoomItem` GraphQL object type
- [x] 5.4 Add `dungeonId`, `floor`, `roomState` fields to `Location` GraphQL type
- [x] 5.5 Add `activeDungeonId` field to `GameSession` GraphQL type
- [x] 5.6 Implement relay-paginated `dungeons(campaignId)` query in `DungeonResolver`
- [x] 5.7 Implement `roomEncounters(dungeonId)` query in `DungeonResolver`
- [x] 5.8 Implement `roomItems(roomId)` query in `DungeonResolver`

## 6. Navigation Tool Handlers

- [x] 6.1 Create `EnterDungeonHandler` — validates dungeon belongs to campaign, sets `activeDungeonId` and `sceneType = DUNGEON`
- [x] 6.2 Create `MoveToRoomHandler` — validates active dungeon, validates adjacency via `connectedLocationIds`, transitions `UNEXPLORED → EXPLORED`, rolls wandering monster die when `encounterTable` is set
- [x] 6.3 Create `ExitDungeonHandler` — clears `activeDungeonId`, sets `sceneType = EXPLORATION`
- [x] 6.4 Register all three handlers in `GameEngineToolRegistrar`
- [x] 6.5 Verify `set_scene_type` handler does NOT clear `activeDungeonId` on any scene transition

## 7. Encounter Tool Handler

- [x] 7.1 Create `SpawnEncounterHandler` — handles `roomId` path (keyed) and `dungeonId + fromTable` path (wandering)
- [x] 7.2 Implement keyed encounter materialization: lookup `RoomEncounter.monsters`, resolve SRD stats via Redis cache, create `Npc` entities with numeric suffixes for multiples
- [x] 7.3 Implement wandering encounter materialization: weighted random selection from `encounterTable`, same NPC creation path
- [x] 7.4 Return `npcIds` array in tool result; validate `activeDungeonId` is set
- [x] 7.5 Register `SpawnEncounterHandler` in `GameEngineToolRegistrar`

## 8. Room State and Loot Tool Handlers

- [x] 8.1 Create `UpdateRoomStateHandler` — validates active dungeon + room ownership, persists `roomState`
- [x] 8.2 Create `AddRoomItemHandler` — validates active dungeon + room and item ownership, creates `RoomItem`
- [x] 8.3 Create `LootRoomHandler` — finds `RoomItem`, calls `ItemService.giveItem`, decrements or removes `RoomItem`, emits `STATE_CHANGED_EVENT`
- [x] 8.4 Register all three handlers in `GameEngineToolRegistrar`

## 9. Quest Integration

- [x] 9.1 Add `DUNGEON` to `QuestEntityType` enum in quest module
- [x] 9.2 Extend `create_quest` tool handler to accept optional `dungeonId`, validate it, and create `QuestEntity(type=DUNGEON)` in the same transaction

## 10. Tests

- [x] 10.1 Unit tests for `DungeonService`: createDungeon, addRoomItem, removeRoomItem, updateRoomState
- [x] 10.2 Unit tests for `EnterDungeonHandler`, `MoveToRoomHandler`, `ExitDungeonHandler` — valid paths and all error codes
- [x] 10.3 Unit tests for `SpawnEncounterHandler` — keyed and wandering paths, SRD resolution, numeric name suffixes
- [x] 10.4 Unit tests for `UpdateRoomStateHandler`, `AddRoomItemHandler`, `LootRoomHandler`
- [x] 10.5 Integration test: full dungeon flow — enter → move → spawn encounter → update room state → loot → exit
- [x] 10.6 Integration test: `activeDungeonId` persists through `COMBAT` scene change and back to `DUNGEON`
- [x] 10.7 Integration test: quest created with `dungeonId` creates `QuestEntity(type=DUNGEON)`
