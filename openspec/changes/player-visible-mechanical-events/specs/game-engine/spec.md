## ADDED Requirements

### Requirement: Successful player-relevant tool results map to visible mechanical events
The game engine orchestration layer SHALL map successful player-relevant tool results into normalized player-visible mechanical events after preserving the raw `TOOL_CALL` event. Eligible mappings SHALL include combat effects, inventory changes, resource use, quest progress, travel, discovery, and dungeon movement when the character directly experiences or observes the result.

#### Scenario: Combat tool maps to visible event
- **WHEN** `apply_damage`, `heal`, `apply_condition`, `remove_condition`, `roll_death_save`, `instant_death`, `start_combat`, or `end_combat` succeeds with a player-observable result
- **THEN** the orchestration layer maps the result into a `COMBAT` player-visible mechanical event

#### Scenario: Inventory tool maps to visible event
- **WHEN** `give_item`, `take_item`, `buy_item`, `sell_item`, `equip_item`, or `unequip_item` succeeds for an item the player can observe
- **THEN** the orchestration layer maps the result into an `INVENTORY` player-visible mechanical event

#### Scenario: Quest tool maps to visible event
- **WHEN** `create_quest`, `update_quest_objective`, `complete_quest`, or `fail_quest` succeeds for a quest visible to the player
- **THEN** the orchestration layer maps the result into a `QUEST` player-visible mechanical event

#### Scenario: Travel or discovery tool maps to visible event
- **WHEN** `travel_to`, `discover_location`, player-witnessed `create_location`, `enter_dungeon`, `exit_dungeon`, or player-directed `move_to_room` succeeds
- **THEN** the orchestration layer maps the result into a `TRAVEL` or `DISCOVERY` player-visible mechanical event as appropriate

### Requirement: Visible event mapping is conservative and player-safe
The game engine orchestration layer SHALL emit no player-visible mechanical event when a tool result is failed, internal, hidden, or lacks enough player-safe data for a deterministic summary. The mapper SHALL NOT infer player-visible facts from hidden tool inputs when the structured result does not expose a safe player-facing summary.

#### Scenario: Internal context tool does not map
- **WHEN** `record_memory`, `search_memories`, `record_npc_memory`, or another context-only tool succeeds
- **THEN** no player-visible mechanical event is produced

#### Scenario: Hidden world state tool does not map by default
- **WHEN** an unrevealed faction, agenda, antagonist, lore, or world-simulation tool succeeds off-screen
- **THEN** no player-visible mechanical event is produced unless the result explicitly represents something the player witnesses

#### Scenario: Insufficient safe data produces no event
- **WHEN** a successful tool result lacks enough player-safe fields to form a visible event title or summary
- **THEN** the mapper produces no player-visible mechanical event rather than guessing from raw hidden inputs
