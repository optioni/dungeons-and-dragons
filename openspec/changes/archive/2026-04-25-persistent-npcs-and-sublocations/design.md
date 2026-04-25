## Context

The DM model currently has access to only 4 tools (`record_npc_memory`, `set_scene_type`, `suggest_actions`, `trigger_spell_prep`) despite ~40 handlers being registered in `GameEngineToolRegistrarService`. The `DM_TOOLS` array in `dm-orchestrator.service.ts` is a stub left from early development with a comment "Extend as GameEngineModule lands."

When the DM narrates a named NPC or introduces a location like "the City Archive", there is no mechanism to persist these entities. NPCs and locations can only be created during campaign setup (`CampaignSetupService`) or as side-effects of `create_quest`. Every subsequent session the DM must reinvent them from scratch, producing inconsistency.

`Location` is a flat graph — all locations are peers connected by `connectedLocationIds`. There is no way to express that "The Rusty Anchor Inn" is inside "Ironhold" without treating the inn as a top-level world node equivalent to a city.

## Goals / Non-Goals

**Goals:**
- Any named NPC the DM introduces gets a database row that persists across sessions
- Any named establishment or sub-location the DM mentions gets a database row anchored to its parent settlement
- The DM model has access to every tool with a registered handler — no hidden capabilities
- Context loader surfaces parent location name so the DM always knows where the player is in the hierarchy

**Non-Goals:**
- UI for browsing sub-locations (out of scope for this change)
- NPC relationship tracking for newly created NPCs (existing `NpcRelationship` flow unchanged)
- Infinite nesting depth — only one level of parent/child is needed (settlement → establishment); deeply nested locations are not a use case

## Decisions

### D1: parentLocationId as a nullable FK on Location (not a separate entity)

A separate `Establishment` or `SubLocation` entity would require new GraphQL types, resolvers, and migration complexity. A nullable `parentLocationId` on `Location` itself reuses all existing infrastructure: the same `travel_to` tool, `LocationDiscovery` table, NPC anchoring, and world context loader. The DM treats sub-locations the same as top-level locations — just with a parent pointer for display and context purposes.

**Alternative considered:** A `locationType` enum (REGION / SETTLEMENT / ESTABLISHMENT) was considered to enforce hierarchy rules, but it adds validation complexity with no clear payoff since the DM prompt guidance already constrains when to use sub-locations.

### D2: create_npc as a standalone tool in WorldMutationService

`create_quest` can already create NPCs as sub-entities, but the DM has no way to create a standalone NPC mid-session without also creating a quest. A dedicated `createNpc()` method in `WorldMutationService` follows the same pattern as `updateNpc()` and returns a structured `WorldOutcome` the DM can recover from if it fails.

**Alternative considered:** Re-using `create_quest`'s NPC sub-creation was rejected — it couples NPC existence to quest existence, which is wrong for background characters like innkeepers.

### D3: Expose all registered handlers to DM_TOOLS at once

Rather than cherry-picking a subset, all ~40 handlers get JSON schema definitions added to `DM_TOOLS`. The LLM is already capable of not calling tools it doesn't need; having unused tools available is lower risk than missing a tool the DM needs mid-scene. The tool descriptions guide appropriate usage.

**Alternative considered:** A progressive rollout (expose 10 tools now, more later) was rejected as unnecessary complexity. The full tool surface is already tested and functional — it was just never wired.

### D4: Context loader adds parent location name, not a separate "breadcrumb" block

When `campaign.currentLocationId` resolves to a location with a `parentLocationId`, the world block line for current location becomes `"City Archive (inside Ironhold)"` rather than just `"City Archive"`. This is the minimal change needed for the DM to maintain spatial coherence. A full location hierarchy traversal is not needed.

### D5: Prompt modules instruct the DM to call create_npc / create_location immediately

The DM should call `create_npc` the first time it introduces a named character and `create_location` the first time it introduces a named establishment, before the narrative continues. This is enforced through explicit instruction in the scene prompt modules (`social.txt`, `settlement.txt`, `exploration.txt`), not through post-processing or server-side inference.

### D6: LocationItem as a new entity separate from RoomItem

The dungeon system already has a `RoomItem` entity (`locationId → Location`, `itemId → Item`, `quantity`, `containerName`) with `add_room_item` and `loot_room` tools. However `add_room_item` requires an active dungeon session and validates the room belongs to it — it cannot be used for overworld locations.

Rather than removing that guard (which would change dungeon semantics), a new `LocationItem` entity is added for non-dungeon locations. It has the same shape as `RoomItem` plus an optional `note` field (a short string explaining how the item got there — "left by the archivist", "dropped in the struggle"). Two new tools accompany it: `place_item` (creates a `LocationItem` row) and `take_item` (moves it to `CharacterItem` via the existing `ItemService.giveItem` path, then deletes the `LocationItem` row).

The context loader includes a `## Items Here` section in the world block when any `LocationItem` rows exist for the current location, listed with name, quantity, and note. This makes overworld item discovery mechanical rather than purely narrative — the player asks "is there anything here?", the DM sees the item in context, and calls `take_item` when the player picks it up.

**Alternative considered:** Generalising `RoomItem` to work for both dungeon rooms and overworld locations was rejected because it would require removing the active-dungeon guard and risk breaking dungeon loot consistency.

## Risks / Trade-offs

**[Risk] DM creates duplicate NPCs/locations if it forgets it already created one** → The `create_npc` and `create_location` tool results return the new entity's ID; the DM should use that ID for subsequent `update_npc` / `travel_to` calls. Prompt instructions will emphasize this. If duplicates occur, they are harmless — the world just has two entries.

**[Risk] Large DM_TOOLS array increases token usage per turn** → Tool definitions are sent with every request. ~40 tools with descriptions and schemas will add ~3–4k tokens per turn. This is acceptable given Sonnet's context window, but tool descriptions must be kept concise.

**[Risk] parentLocationId creates orphaned sub-locations if parent is deleted** → There is no cascade delete in MikroORM for this pattern without explicit configuration. Since we never delete locations, this is not a practical concern for the current development stage.

## Migration Plan

1. Create MikroORM migration adding `parent_location_id` nullable integer column to `location` table
2. No data backfill needed — all existing locations correctly have `parentLocationId = null`
3. No rollback complexity — column is nullable; removing it later requires only a migration

## Open Questions

- Should `travel_to` treat movement between sub-locations of the same parent differently (free, no encounter roll) vs. movement between top-level locations? The current tool doesn't distinguish — leaving this for a follow-up change.
- Should the GraphQL `locations` query support filtering by `parentLocationId`? Deferring to when the web UI needs it.
