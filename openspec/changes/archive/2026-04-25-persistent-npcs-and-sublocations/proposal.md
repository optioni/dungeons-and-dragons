## Why

NPCs invented by the DM during play vanish between sessions because there is no `create_npc` tool — they exist only as prose. Similarly, named establishments within a settlement (an inn, a city archive) cannot be persisted as locations because `Location` has no parent-child relationship and the tools to create them are not exposed to the DM model. The result is a world that feels inconsistent: the same archivist must be re-invented every visit, and "you're in Ironhold" is as specific as the system can get.

## What Changes

- Add `parentLocationId` (nullable FK → Location) to the `Location` entity so settlements can contain named establishments
- Add `LocationItem` entity (locationId, itemId, quantity, note) and two tools — `place_item` (DM/NPC leaves an item at a location) and `take_item` (player picks it up into inventory)
- Add `createNpc()` to `WorldMutationService` and register a `create_npc` tool handler
- Update `create_location` handler to accept and pass through `parent_location_id`
- Expose the full registered tool set to the DM model — `DM_TOOLS` currently contains only 4 of the ~40 registered handlers; all game-engine tools should be available to the model
- Update `ContextLoader.loadWorldBlock` to surface the parent location name when `currentLocationId` is a sub-location
- Update `social.txt`, `settlement.txt`, and `exploration.txt` prompt modules to instruct the DM to call `create_npc` for named NPCs and `create_location` for named establishments

## Capabilities

### New Capabilities

- `npc-creation-tool`: DM tool (`create_npc`) to persist any named NPC encountered during play, anchored to the current location, with full Npc entity fields (name, profession, disposition, personality, agenda, etc.)
- `sub-locations`: parentLocationId on Location enabling settlement → establishment hierarchy; context loader surfaces parent name; DM instructed to create locations as it introduces them
- `location-items`: items that exist at a location in the world — not in a character's inventory, not in an NPC's stock — so NPCs can leave things behind and players can discover them

### Modified Capabilities

- `llm-orchestration`: `DM_TOOLS` expanded from 4 to the full set of registered game-engine handlers — all combat, dice, rest, travel, item, leveling, world, dungeon, quest, campaign, and memory tools are now described and available to the model

## Impact

- **Schema**: `Location` gets a new nullable `parentLocationId` column; migration required
- **API**: `WorldMutationService.createNpc()` is new; `TravelService.createLocation()` gains `parentLocationId` param
- **LLM surface**: `DM_TOOLS` array in `dm-orchestrator.service.ts` grows significantly — all ~40 registered tool handlers get JSON schema definitions
- **Prompt modules**: `social.txt`, `settlement.txt`, `exploration.txt` updated with persistence instructions
- **Context loader**: `loadWorldBlock` updated to include parent location name for sub-locations
- **No breaking changes to existing data** — `parentLocationId` is nullable; all existing locations remain valid; `LocationItem` is a new table alongside the existing `RoomItem` (dungeon-only)
