# npc-creation-tool Specification

## Purpose
TBD - created by archiving change persistent-npcs-and-sublocations. Update Purpose after archive.
## Requirements
### Requirement: DM can create NPCs mid-session via create_npc tool
The system SHALL provide a `create_npc` tool available to the DM model. Executing this tool SHALL persist a new `Npc` row for the active campaign and return the new NPC's ID in the structured result. The tool SHALL accept: `name` (required), and optionally `description`, `profession`, `disposition`, `personality_traits` (array of strings), `speech_style`, `core_motivation`, `agenda`, and `current_location_id`.

#### Scenario: DM creates a named NPC during social play
- **WHEN** the DM invokes `create_npc` with a name and optional fields
- **THEN** the system persists a new `Npc` row linked to the active campaign and returns `{ success: true, data: { npcId: <id> } }`

#### Scenario: create_npc with current_location_id anchors the NPC to that location
- **WHEN** the DM invokes `create_npc` with a valid `current_location_id`
- **THEN** the new NPC row has `currentLocationId` set to that value so it appears in the DM's location context on subsequent turns

#### Scenario: create_npc with no current_location_id creates an unanchored NPC
- **WHEN** the DM invokes `create_npc` without `current_location_id`
- **THEN** the NPC is created with `currentLocationId = null` and does not appear in location-scoped NPC lists until updated

#### Scenario: create_npc result can be used to anchor subsequent tool calls
- **WHEN** the DM creates an NPC and receives its `npcId`
- **THEN** that ID can immediately be used in subsequent `update_npc`, `record_npc_memory`, `add_to_party`, and item tool calls within the same turn

#### Scenario: NPC creation emits a state-changed event
- **WHEN** `create_npc` successfully persists a new NPC
- **THEN** `WorldMutationService` emits a `NPC_CREATED` `StateChangedEvent` so that any active stream consumers can react (e.g., cache invalidation)

### Requirement: Scene prompt modules instruct the DM to persist named NPCs immediately
The `social.txt`, `settlement.txt`, and `exploration.txt` prompt modules SHALL include explicit instructions directing the DM to call `create_npc` the first time any named NPC is introduced in play, before the narrative continues past the introduction.

#### Scenario: Named NPC introduced in settlement scene is persisted
- **WHEN** the DM narrates a named NPC in a SETTLEMENT or SOCIAL scene
- **THEN** the DM calls `create_npc` with that NPC's name and any known attributes before producing further narrative about them

#### Scenario: Unnamed background characters are not persisted
- **WHEN** the DM references unnamed background characters (e.g., "a few dockworkers", "a passing merchant")
- **THEN** the DM does NOT call `create_npc` for these characters

### Requirement: Any item the player acquires during play is persisted immediately
The system SHALL instruct the DM to call `create_item` followed by `give_item` whenever the player acquires any object — whether handed over by an NPC, found on the ground, picked up from the environment, or received as a reward. This instruction SHALL appear in `social.txt`, `settlement.txt`, `exploration.txt`, and `dungeon.txt`. The item SHALL be created as a campaign `Item` row and transferred to the character's inventory via `give_item` before the narrative continues. Items that exist only in narration and not in the database are not valid acquisitions. Note: dungeon room loot that is handled via `loot_room` is already persisted by that tool and does not require a separate `create_item` + `give_item` call.

#### Scenario: NPC gives the player a named object
- **WHEN** the DM narrates an NPC handing, dropping, or leaving an item for the player to take
- **THEN** the DM calls `create_item` to create the item and then `give_item` with `to_character_id` to place it in the player's inventory

#### Scenario: Player picks up a found item during exploration
- **WHEN** the DM narrates the player picking up, finding, or looting any named object
- **THEN** the DM calls `create_item` (if the item is not already in the campaign) and `give_item` to reflect the acquisition in the character's inventory

#### Scenario: Item received is queryable in character inventory after the turn
- **WHEN** the player asks to see their inventory or a system query checks character items after an acquisition turn
- **THEN** the acquired item appears in the character's `CharacterItem` records

#### Scenario: Unnamed ambient objects are not persisted
- **WHEN** the DM describes background scenery objects that the player does not take (e.g., "crates line the walls", "a lantern hangs overhead")
- **THEN** the DM does NOT call `create_item` for these objects

