## Why

The LLM resolves game mechanics by calling server-side tools. Without a game engine implementing D&D 5e rules, the LLM has no way to roll dice, apply damage, track combat, manage rests, handle death saves, manage items, or advance time. Every mechanical action in the game flows through this module.

## What Changes

- `GameEngineModule` exposing all LLM-callable tools:
  - Dice: `roll_dice`
  - Combat: `start_combat`, `end_combat`, `advance_initiative`, `apply_damage`, `heal`, `apply_condition`, `remove_condition`
  - Death: `roll_death_save`, `instant_death`, `stabilise`
  - Skills: `check_skill` (skill + proficiency bonus), `check_ability` (raw ability check, no proficiency)
  - Rests: `take_short_rest`, `take_long_rest` (triggers diary + world tick)
  - Items: `create_item`, `give_item`, `equip_item`, `unequip_item`, `buy_item`, `sell_item`, `restock_merchant`
  - Spells: `use_spell_slot`, `prepare_spells`
  - Leveling: `trigger_level_up`, `apply_level_up`
  - Narrative: `set_scene_type`, `advance_antagonist_stage`, `record_lore`
  - Travel: `travel_to`, `discover_location`, `create_location`
  - World: `update_location_state`, `shift_faction_disposition`, `trigger_world_event`, `resolve_world_event`, `update_npc`, `add_to_party`, `remove_from_party`, `trigger_catastrophe`
- Quest auto-checker hook on all state-changing tools
- Combat panel UI in game view (slides in on `start_combat`, out on `end_combat`)
- Level-up panel UI

## Capabilities

### New Capabilities
- `dice-and-checks`: `roll_dice`, `check_skill`, `check_ability` — randomness, skill resolution, and raw ability checks
- `combat-mechanics`: Initiative, action economy, damage, healing, conditions, death saves
- `rest-mechanics`: Short and long rest, resource recovery, day advancement trigger
- `item-mechanics`: Item creation, transfer, equipping, merchant transactions
- `travel-mechanics`: Location travel, discovery, procedural location generation
- `world-mutations`: Location state, faction disposition, world events, NPC updates, party management
- `leveling-mechanics`: XP thresholds, level-up flow, stat updates
- `combat-ui`: Combat panel with initiative tracker, action economy, quick actions, spell slots

### Modified Capabilities
- `game-session`: Adds quest auto-checker hook triggered after each tool call
- `game-view-ui`: Adds combat panel that slides in/out based on combat state

## Impact

- New `GameEngineModule` in `api/`
- Depends on all prior changes
- `world-system` depends on `take_long_rest` triggering the world tick queue job
