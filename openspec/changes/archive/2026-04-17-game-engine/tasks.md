## 1. Database Migrations

- [x] 1.1 Create `CombatSession` entity with OneToOne relation to `GameSession`, storing combatants JSON, currentTurnIndex, and roundNumber
- [x] 1.2 Add `deathSaveSuccesses` and `deathSaveFailures` integer columns (default 0) to `character` table
- [x] 1.3 Add `levelUpPending` boolean column (default false) to `game_session` table
- [x] 1.4 Generate and run MikroORM migration covering all new columns and the `combat_session` table

## 2. Core Infrastructure

- [x] 2.1 Create `DiceService` with `roll(expression)`, `d20()`, and `withSeed(seed)` methods supporting `NdX±M`, `kh`, and `kl` notation
- [x] 2.2 Define `ToolRegistry` in `LLMModule` — a map of tool name → handler; expose `register(name, handler)` method
- [x] 2.3 Create `GameEngineModule` with `GameEngineToolRegistrar` that calls `registry.register(...)` for all tools in `onModuleInit`
- [x] 2.4 Define typed `StateChangedEvent` (type, entityId, campaignId) and wire `EventEmitter2` into `GameEngineModule`

## 3. Dice and Skill Checks

- [x] 3.1 Implement `roll_dice` tool: parse expression, roll server-side, return `{ total, rolls, expression }` or `{ success: false, reason: "INVALID_EXPRESSION" }`
- [x] 3.2 Implement `check_skill` tool: resolve ability modifier + proficiency (including expertise), roll 1d20, compare to DC, return full breakdown
- [x] 3.3 Implement `check_ability` tool: resolve raw ability modifier, roll 1d20, compare to DC, return breakdown without proficiency
- [x] 3.4 Write unit tests for `DiceService` using seeded PRNG and for all three dice/check tools

## 4. Combat Mechanics

- [x] 4.1 Implement `start_combat` tool: create `CombatSession`, auto-roll missing initiatives, sort descending, return ordered combatant list; error if combat already active
- [x] 4.2 Implement `advance_initiative` tool: reset current combatant action economy, increment turn index (wrap at end), increment round counter; error if no active combat
- [x] 4.3 Implement `apply_damage` tool: decrement `Character.hp` (min 0) or NPC HP in combatants JSON; return `{ newHp, downed, massiveDamage? }`; emit `StateChangedEvent DAMAGE`
- [x] 4.4 Implement `heal` tool: increment `Character.hp` (cap at maxHp) or NPC HP in combatants JSON; reset death save counters if character was at 0 HP
- [x] 4.5 Implement `apply_condition` and `remove_condition` tools: update conditions array on combatant entry; mirror to `Character.conditions` for player
- [x] 4.6 Implement `roll_death_save` tool: roll 1d20, increment success/failure counter, return discriminated union `ONGOING | STABILISED | DEAD`
- [x] 4.7 Implement `stabilise` tool: set `Character.hp = 1`, reset death save counters
- [x] 4.8 Implement `instant_death` tool: set `Character.alive = false`, emit `StateChangedEvent NPC_KILLED` (or character death flag); bypass death saves
- [x] 4.9 Implement `end_combat` tool: persist final HP to `Npc.hp` for named NPCs, sync player conditions back to `Character.conditions`, delete `CombatSession`
- [x] 4.10 Write unit tests for all combat tools including initiative wrap-around, massive damage, death save outcomes, and end-combat HP sync

## 5. Rest Mechanics

- [x] 5.1 Implement `take_short_rest` tool: spend hit dice (capped at remaining), restore HP up to maxHp, decrement `Character.hitDiceRemaining`, do NOT advance inGameDate
- [x] 5.2 Implement `take_long_rest` tool: restore HP/spell slots/hit dice (up to half level rounded up), reset death save counters, increment `Campaign.inGameDate`
- [x] 5.3 Wire `take_long_rest` async side effects: fire-and-forget `MemoryModule.writeDiaryEntry(campaignId)` and `QueueModule.enqueueWorldTick(campaignId)` (guard with `@Optional()` for QueueService)
- [x] 5.4 Write unit tests for short rest capping, long rest full restore, inGameDate increment, and optional world tick enqueue

## 6. Travel Mechanics

- [x] 6.1 Implement `travel_to` tool: validate `LocationDiscovery(campaignId, locationId)` exists, update `Campaign.currentLocationId`, emit `StateChangedEvent TRAVEL`; error `UNDISCOVERED_LOCATION` if not found
- [x] 6.2 Implement `discover_location` tool: create `LocationDiscovery` record idempotently with source and optional sourceId
- [x] 6.3 Implement `create_location` tool: persist `Location`, auto-call `discover_location` with `source: EXPLORATION` atomically; return location with id
- [x] 6.4 Write unit tests for travel validation, idempotent discovery, create-then-travel flow

## 7. Item Mechanics

- [x] 7.1 Implement `create_item` tool: persist `Item` entity with all fields; return item id
- [x] 7.2 Implement `give_item` tool: create/increment `CharacterItem` or `NpcItem`; auto-create `LocationDiscovery` records if item has `mapId` and recipient is character; emit `StateChangedEvent GIVE_ITEM`
- [x] 7.3 Implement `equip_item` and `unequip_item` tools: set/clear `CharacterItem.equippedSlot`; return `SLOT_OCCUPIED` error if slot taken
- [x] 7.4 Implement `buy_item` tool: atomic transaction — verify NPC stock, decrement `NpcItem.quantity`, increment `CharacterItem`, deduct gold from `Character`; error `INSUFFICIENT_GOLD` on rollback
- [x] 7.5 Implement `sell_item` tool: atomic transaction — remove/decrement `CharacterItem`, credit gold to `Character`, increment `NpcItem.quantity` (or create new NpcItem)
- [x] 7.6 Implement `restock_merchant` tool: replace `NpcItem` rows for the given NPC inside a transaction
- [x] 7.7 Write unit tests for give_item map discovery, equip conflict, buy/sell gold atomicity, and restock replacement

## 8. Leveling Mechanics

- [x] 8.1 Implement `trigger_level_up` tool: set `GameSession.levelUpPending = true`, return structured payload (new level, hit die, ASI options, class features); error `LEVEL_UP_ALREADY_PENDING` if flag already set
- [x] 8.2 Implement `apply_level_up` tool: validate choices (ASI total ≤ 2 or feat), increment `Character.level`, apply ability scores, add `hitPointsRolled + CON modifier` to `maxHp`, update spell slots, clear `levelUpPending`
- [x] 8.3 Implement `use_spell_slot` tool: find matching slot entry, increment `used` if `used < total`; error `NO_SPELL_SLOT_AVAILABLE` otherwise
- [x] 8.4 Implement `prepare_spells` tool: update `Character.preparedSpells` with provided list (trust LLM for timing)
- [x] 8.5 Write unit tests for level-up two-step flow, invalid ASI, hp increase calculation, and exhausted spell slots

## 9. World Mutations

- [x] 9.1 Implement `update_npc` tool: partial update of Npc fields; emit `StateChangedEvent NPC_UPDATE` or `NPC_KILLED` when `alive = false`
- [x] 9.2 Implement `add_to_party` tool: set `Npc.partyStatus = COMPANION`, set `Npc.nextTickInGameDate = null`
- [x] 9.3 Implement `remove_from_party` tool: set `Npc.partyStatus = NONE`
- [x] 9.4 Implement `update_location_state` tool: update `Location.currentState`; error `LOCATION_NOT_FOUND` if missing
- [x] 9.5 Implement `shift_faction_disposition` tool: update `Faction.playerDisposition`
- [x] 9.6 Implement `trigger_world_event` tool: persist `WorldEvent` with `status: ACTIVE`
- [x] 9.7 Implement `resolve_world_event` tool: set `WorldEvent.status = RESOLVED`, store outcome text
- [x] 9.8 Implement `trigger_catastrophe` tool: persist `WorldEvent` with `source: CATASTROPHE` and `status: ACTIVE`
- [x] 9.9 Implement `set_scene_type` tool: update `GameSession.sceneType`
- [x] 9.10 Implement `advance_antagonist_stage` tool: increment `Campaign.antagonistStage` (or move to next stage in the stages array)
- [x] 9.11 Implement `record_lore` tool: append lore text to `Campaign.loreDocument`
- [x] 9.12 Write unit tests for NPC kill event, party status updates, world event lifecycle, and lore append

## 10. Game Session — Quest Auto-Checker Hook

- [x] 10.1 Wire `EventEmitter2` emission after all state-changing tools (`apply_damage`, `heal`, `give_item`, `travel_to`, `update_npc`, `instant_death`) with correct typed event payloads
- [x] 10.2 Write unit tests verifying `StateChangedEvent` is emitted with correct type and entityId for each state-changing tool; verify tool response is not blocked by event errors

## 11. Frontend — Game View UI

- [x] 11.1 Update play layout to monitor `GameSession.sceneType`; add left column slot that is present when `sceneType = COMBAT` and absent otherwise
- [x] 11.2 Animate layout transition: combat panel slides in/out from left without collapsing narrative column
- [x] 11.3 Implement level-up panel overlay: show when `levelUpPending = true`, display new level, hit die instructions, ASI/feat choices; disable standard text input while open
- [x] 11.4 Wire `apply_level_up` mutation to level-up panel submit; dismiss panel and re-enable input on success
- [x] 11.5 Write component tests for layout transitions and level-up panel open/close behaviour

## 12. Frontend — Combat Panel UI

- [x] 12.1 Implement `CombatPanel` component: display combatants in initiative order with name, HP bar, max HP, and active condition badges
- [x] 12.2 Highlight the current combatant (based on `currentTurnIndex`); animate highlight change on initiative advance
- [x] 12.3 Display player action economy section: Action, Bonus Action, Reaction, movement — filled/spent state from `CombatSession.combatants` entry
- [x] 12.4 Render quick action buttons (Attack, Cast Spell, Dash, Dodge, Other): clicking pre-fills player text input; disable all buttons while DM stream is active
- [x] 12.5 Display spell slot pips grouped by level for spellcasting characters; hide section for non-spellcasters
- [x] 12.6 Write component tests for HP bar proportions, condition badges, action economy states, and disabled quick actions during stream
