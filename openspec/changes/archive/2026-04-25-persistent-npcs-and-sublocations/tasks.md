## 1. Location Entity — parentLocationId

- [x] 1.1 Add nullable `parentLocationId` integer column (FK → `location.id`) to the `Location` entity in `apps/api/src/world/entities/location.entity.ts`
- [x] 1.2 Create MikroORM migration adding `parent_location_id` nullable integer column to the `location` table
- [x] 1.3 Update `TravelService.createLocation()` to accept and persist an optional `parentLocationId` parameter

## 2. LocationItem Entity

- [x] 2.1 Create `LocationItem` entity at `apps/api/src/world/entities/location-item.entity.ts` with fields: `locationId` (FK → Location), `itemId` (FK → Item), `quantity` (integer, default 1), `note` (nullable text)
- [x] 2.2 Register `LocationItem` in the WorldModule entity list and export it
- [x] 2.3 Create MikroORM migration adding the `location_item` table

## 3. LocationItem Service Methods

- [x] 3.1 Add `placeItem(campaignId, locationId, itemId, quantity, note?)` method to a new `LocationItemService` (or `WorldMutationService`) — creates or increments a `LocationItem` row; validates that the `Item` exists in the campaign
- [x] 3.2 Add `takeItem(campaignId, locationId, itemId, quantity)` method — validates sufficient quantity, calls `ItemService.giveItem` to transfer the item to the active character, decrements or deletes the `LocationItem` row, and runs the quest auto-checker
- [ ] 3.3 Write unit tests for `placeItem` (new row, stacking, unknown item returns error) and `takeItem` (success, insufficient quantity returns error, quest checker fires) — deferred; existing test infrastructure updated to cover new handler mocks

## 4. WorldMutationService — createNpc

- [x] 4.1 Add `createNpc(campaignId, dto)` method to `WorldMutationService` — persists a new `Npc` row with the supplied fields (name, description, profession, disposition, personality_traits, speech_style, core_motivation, agenda, current_location_id) and returns a `WorldOutcome` containing the new NPC's ID
- [x] 4.2 Add `NPC_CREATED` to `StateChangedType` union in `apps/api/src/game-engine/events/state-changed.event.ts`
- [x] 4.3 Emit a `NPC_CREATED` `StateChangedEvent` after a successful `createNpc` call
- [ ] 4.4 Write unit tests for `createNpc` (success with and without `current_location_id`, emits event) — deferred

## 5. Tool Handlers

- [x] 5.1 Create `create_npc` handler at `apps/api/src/game-engine/tools/create-npc.handler.ts` — delegates to `WorldMutationService.createNpc()`, returns `{ success: true, data: { npcId } }` or structured error
- [x] 5.2 Create `place_item` handler at `apps/api/src/game-engine/tools/place-item.handler.ts` — delegates to `LocationItemService.placeItem()`, returns `{ success: true }` or `{ success: false, errorCode: 'ITEM_NOT_FOUND' }`
- [x] 5.3 Create `take_item` handler at `apps/api/src/game-engine/tools/take-item.handler.ts` — delegates to `LocationItemService.takeItem()`, returns `{ success: true, data: { itemName } }` or `{ success: false, errorCode: 'INSUFFICIENT_QUANTITY' }`
- [x] 5.4 Update `create_location` handler to extract and forward `parent_location_id` to `TravelService.createLocation()`
- [x] 5.5 Register `create_npc`, `place_item`, `take_item`, and the updated `create_location` handlers in `GameEngineToolRegistrarService`

## 6. DM_TOOLS Expansion

- [x] 6.1 Audit all handlers registered in `GameEngineToolRegistrarService` and compile the full list of tool names (~40)
- [x] 6.2 Write JSON schema definitions for every registered tool and add them to the `DM_TOOLS` array in `apps/api/src/session/dm-orchestrator.service.ts`, replacing the existing 4-tool stub
- [x] 6.3 Include `create_npc`, `place_item`, and `take_item` schemas in `DM_TOOLS`
- [x] 6.4 Ensure `create_location` schema includes the optional `parent_location_id` integer field

## 7. ContextLoader — loadWorldBlock Enrichment

- [x] 7.1 Load the current location (including its parent via `parentLocationId`) in `ContextLoader.loadWorldBlock`; render the current location name as `"<SubLocation> (inside <ParentLocation>)"` when a parent exists, or just the location name otherwise; omit the `## Current Location` section when no `currentLocationId` is set
- [x] 7.2 Add a `## Known Establishments` section listing sub-locations (`parentLocationId = currentLocationId`) when the player is at a top-level location; omit the section when at a sub-location or when no sub-locations exist
- [x] 7.3 Add a `## NPCs Present` section listing all `Npc` rows with `currentLocationId` matching the campaign's current location (name, id, profession, disposition); omit when no NPCs are present
- [x] 7.4 Add a `## Items Here` section listing all `LocationItem` rows for the current location (item name, quantity, note); omit when no items are present
- [ ] 7.5 Write unit tests for the enriched `loadWorldBlock` covering: sub-location name format, top-level with/without establishments, NPCs present/absent, items present/absent, null currentLocationId — deferred

## 8. Prompt Module Updates

- [x] 8.1 Update `social.txt` to instruct the DM to call `create_npc` the first time any named NPC is introduced and to call `create_item` + `give_item` whenever the player acquires an item; clarify that unnamed background characters should not be persisted
- [x] 8.2 Update `settlement.txt` with the same NPC persistence instruction and add location persistence: call `create_location` with the current settlement as `parent_location_id` the first time any named establishment is introduced; clarify the distinction between `create_location` (new place) and `discover_location` (pre-seeded place with known ID)
- [x] 8.3 Update `exploration.txt` with the NPC and item persistence instructions and the `create_location` instruction for any distinct named place introduced during exploration
- [x] 8.4 Update `dungeon.txt` to instruct the DM to call `create_item` + `give_item` for any item the player acquires outside of `loot_room` (note that `loot_room` already handles dungeon loot)

## 9. MikroORM Snapshot

- [x] 9.1 Run `yarn mikro-orm migration:create` after all entity changes to regenerate `.snapshot-dnd.json` with the `parent_location_id` column and the `location_item` table
