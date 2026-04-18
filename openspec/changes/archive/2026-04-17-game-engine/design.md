## Context

`GameEngineModule` is the mechanical backbone of the game. Every D&D action the LLM resolves — rolling dice, dealing damage, resting, travelling, leveling up, managing items — flows through tools this module exposes. The module is already referenced in the design spec and in proposals for `world-system` and `quest-system`, which both depend on it.

Existing foundations:

- `Character`, `Item`, `CharacterItem` entities and their CRUD operations exist (character-system)
- `GameSession` and `GameEvent` entities exist (session-and-llm); `LLMModule` already dispatches tool calls to registered handlers
- `SrdSpell`, `SrdCondition`, `SrdEquipment`, `SrdMonster`, `SrdClass` are seeded and queryable
- `CampaignModule` owns `inGameDate` and `antagonistStages`
- `Location`, `LocationDiscovery`, `Faction`, `WorldEvent`, `Npc` entities exist (world-entities spec)
- `Quest`, `QuestObjective`, `QuestEntity` will be added by `quest-system` (concurrent change)
- `QueueModule` (BullMQ) will be available when `world-system` is implemented

## Goals / Non-Goals

**Goals:**

- Implement all 40+ LLM-callable tool functions listed in the proposal as injectable `GameEngineService` methods
- Register every tool with `LLMModule` so it is callable from the DM session stream
- Track combat state persistently across tool calls (initiative, HP, conditions, action economy)
- Run the quest auto-checker after every state-changing tool call via `EventEmitter2`
- Implement `take_long_rest` to increment `inGameDate`, trigger diary write, and enqueue the world tick BullMQ job
- Implement `trigger_level_up` / `apply_level_up` two-step level-up flow with session pause
- Keep all tool implementations as pure services — no HTTP controllers, no direct GraphQL resolvers needed for tools

**Non-Goals:**

- The quest auto-checker logic itself (owned by `quest-system`); this module only emits the event
- World tick processing (owned by `world-system`); this module only enqueues the job
- Diary writing (owned by `memory-system`); `take_long_rest` calls `MemoryService.writeDiaryEntry()`
- GraphQL queries for reading game state (each owning module exposes its own queries)
- Multiplayer or concurrent session support

## Decisions

### 1. Tool registration via a shared `ToolRegistry` provided by LLMModule

`LLMModule` owns a `ToolRegistry` — a map of tool name → handler function. Each module that provides tools calls `registry.register(name, handler)` in its `onModuleInit`. `GameEngineModule` uses `onModuleInit` to register all ~40 tools in one place (`GameEngineToolRegistrar` service).

Alternative considered: a `@Tool()` decorator and module-scan approach (similar to NestJS `@MessagePattern`). Rejected — it adds reflection complexity and makes handler discovery non-obvious. Explicit registration in one file is easier to audit.

### 2. Combat state stored as a `CombatSession` entity on `GameSession`

`start_combat` creates a `CombatSession` row (OneToOne with `GameSession`). It holds initiative order, current turn index, per-combatant action economy flags (used action, bonus action, reaction, movement remaining), and HP snapshots for NPC combatants. `end_combat` deletes the row.

`CombatSession` combatants JSON:

```ts
{
  id: string;               // characterId or npcId
  type: 'CHARACTER' | 'NPC';
  name: string;
  initiativeRoll: number;
  currentHp: number;
  maxHp: number;
  conditions: string[];
  usedAction: boolean;
  usedBonusAction: boolean;
  usedReaction: boolean;
  movementUsed: number;     // feet used this turn
}
```

HP for the player character is always read from `Character.hp` at turn start; HP in `CombatSession` is authoritative only for NPCs (whose HP is not tracked on the `Npc` entity outside combat). Character conditions are mirrored from `Character.conditions` and synced back on `end_combat`.

Alternative considered: storing combat state as a JSONB column on `GameSession`. Rejected — combat duration is bounded (one session), the data has relational semantics (linked combatants), and a separate entity makes `end_combat` a clean `DELETE` rather than a null-update.

### 3. Quest auto-checker via `EventEmitter2` (loose coupling)

After every state-changing tool call, `GameEngineService` emits a typed event:

```ts
@Event('engine.state-changed')
class StateChangedEvent {
  type: 'TRAVEL' | 'DAMAGE' | 'GIVE_ITEM' | 'NPC_UPDATE' | 'NPC_KILLED';
  entityId: string;
  campaignId: string;
}
```

`QuestModule` listens for this event and runs the auto-checker query. `GameEngineModule` has zero import dependency on `QuestModule`.

Alternative considered: `GameEngineModule` imports `QuestService` directly. Rejected — `quest-system` is a separate change; coupling them means neither can be tested or deployed independently.

### 4. World-mutating tools delegate to WorldModule via injected service interfaces

Tools like `update_npc`, `shift_faction_disposition`, `trigger_world_event`, `resolve_world_event`, and `trigger_catastrophe` logically modify world entities owned by `WorldModule`. `GameEngineModule` injects `WorldService` (from `WorldModule`) and calls its methods directly.

`WorldModule` is imported into `GameEngineModule` — a straightforward directional dependency. `GameEngineModule` never owns world entity persistence; it only orchestrates the call.

Alternative considered: route world mutations through `EventEmitter2` the same way as the quest auto-checker. Rejected — world mutations are synchronous results that the LLM sees immediately in the tool response; fire-and-forget events would lose the structured return value.

### 5. Dice rolling via a seedable `DiceService`

`DiceService` is a thin injectable wrapper around a seeded PRNG. It exports:

- `roll(expression: string): RollResult` — parses e.g. `"2d6+3"`, returns `{ total, rolls, expression }`
- `d20(): number`
- `withSeed(seed: string): DiceService` — returns a new instance using a deterministic seed (for testing)

Production uses `Math.random()`. Tests inject a seeded instance.

`DiceService` is registered as a provider in `GameEngineModule` and injected wherever randomness is needed (`GameEngineService`, `CombatService`, `DeathSaveService`).

### 6. `take_long_rest` orchestrates three side effects in sequence

1. `Character`: restore HP to max, restore all spell slots, reset hit dice used
2. `Campaign.inGameDate`: increment by 1
3. `MemoryModule.writeDiaryEntry(campaignId)`: Haiku call, runs async (fire-and-forget from the tool's perspective — result is not needed before responding to LLM)
4. `QueueModule.enqueueWorldTick(campaignId)`: adds BullMQ job

The tool returns immediately after steps 1–2, confirming the rest. Steps 3–4 run as async non-blocking calls. The LLM does not need to wait for diary or world tick before narrating the morning.

If `QueueModule` is not yet registered (e.g., `world-system` not yet deployed), the `enqueueWorldTick` call is guarded by an optional injection (`@Optional()` decorator on `QueueService`).

### 7. Level-up flow via a `LEVEL_UP_PENDING` flag on `GameSession`

`trigger_level_up` sets `GameSession.levelUpPending = true` and returns a structured JSON payload to the LLM: the character's current level, class hit die, available ability score improvements, and class feature options at the new level.

The LLM narrates "You feel power surging through you — let's take a moment for you to choose your new abilities." The frontend polls or listens to a `sessionUpdated` subscription; when it sees `levelUpPending = true`, it opens the level-up panel.

`apply_level_up` accepts the player's choices (ASI or feat, new hit points rolled, new abilities), validates them, commits them to `Character`, increments `Character.level`, and clears `GameSession.levelUpPending`.

Alternative considered: use a dedicated `LevelUpSession` entity. Rejected — the data is ephemeral (one pending level-up at a time), and the choices JSON is small enough to pass inline in the `apply_level_up` tool call.

### 8. Item transactions are atomic via MikroORM transactions

`buy_item` and `sell_item` modify both `CharacterItem` (quantity changes) and `Character.gold` in a single MikroORM transaction. If either operation fails, both roll back. `restock_merchant` replaces `NpcItem` rows for the specified NPC inside a transaction.

Gold is stored as an integer (copper pieces) internally. The tool API accepts and returns gold pieces (integer); the service converts.

Alternative considered: store gold as a float. Rejected — floating-point arithmetic on currency causes off-by-one errors at scale.

### 9. `travel_to` validates discovery before moving

Before moving `Campaign.currentLocationId`, `travel_to` queries `LocationDiscovery` for `(campaignId, locationId)`. If no record exists, the tool returns a structured error: `{ success: false, reason: "UNDISCOVERED_LOCATION" }`. The LLM recovers in narrative.

After a successful move, the tool emits a `StateChangedEvent` with `type: 'TRAVEL'` so the quest auto-checker can evaluate `REACH_LOCATION` objectives.

### 10. Death save state on Character entity

`Character` gains `deathSaveSuccesses: number` and `deathSaveFailures: number` (both default 0). `roll_death_save` increments the appropriate counter, checks for stabilisation (3 successes) or death (3 failures), and returns a discriminated union:

```ts
type DeathSaveResult =
  | { outcome: 'ONGOING'; successes: number; failures: number }
  | { outcome: 'STABILISED' }
  | { outcome: 'DEAD' };
```

`stabilise` sets `hp = 1` and resets both counters. `instant_death` sets `Character.alive = false` directly, bypassing death saves.

Counters are reset to 0 on any healing (> 0 HP received while at 0 HP) and on `take_short_rest` or `take_long_rest`.

## Risks / Trade-offs

**NPC HP only exists during combat** — NPC HP is tracked in `CombatSession.combatants` JSON, not on the `Npc` entity (spec: `Npc.hp` is nullable, only set for companions and combat-capable NPCs). If a combat ends abruptly (server crash), NPC HP is lost and combat cannot resume cleanly.
→ Mitigation: `end_combat` persists final HP to `Npc.hp` for named NPCs (those with `hp IS NOT NULL` before combat started). Anonymous enemies are discarded. Acceptable for this scope.

**EventEmitter2 is fire-and-forget** — if `QuestModule` listener throws, the tool call has already returned successfully. Quest objectives may not complete.
→ Mitigation: `QuestModule` listener wraps in try/catch and logs failures. Quest auto-checker failure is non-fatal — the LLM can also call `update_quest_objective` manually.

**`take_long_rest` async side effects** — if diary write or world tick enqueue fails after character state is already updated, the day advances but the world does not tick.
→ Mitigation: diary write and world tick are best-effort for current scope (no deployed prod). A follow-up can add a compensating job or an idempotent retry flag on the campaign.

**40+ tools in one module** — the tool list is large. Grouping into sub-services (CombatService, ItemService, TravelService, NarrativeService) keeps each service testable in isolation, but the registration surface is still wide.
→ Mitigation: `GameEngineToolRegistrar` holds all registrations. Sub-services handle domain logic. Each sub-service has its own unit test file.

**MikroORM transaction scope for buy/sell** — `CharacterService.updateGold()` may not be aware it is inside a game engine transaction. Nested transactions need careful handling.
→ Mitigation: use `em.fork()` with explicit `em.transactional()` wrapping the full tool call. `CharacterService` accepts an optional `EntityManager` parameter (standard MikroORM pattern) so the same EM is shared across operations.

## Migration Plan

1. Add `CombatSession` entity and migration (`combat_session` table, OneToOne with `game_session`)
2. Add `deathSaveSuccesses`, `deathSaveFailures` columns to `character` table
3. Add `levelUpPending` boolean column to `game_session` table
4. Add composite index on `quest_objective(type, entity_id, completed)` — owned by `quest-system` migration but documented here as a dependency of the auto-checker
5. No data migrations — all new columns default to 0 or false

Rollback: drop the new columns and the `combat_session` table. No existing data affected.

## Open Questions

- **`check_skill` vs. `check_ability` — DC source**: Both tools accept a `dc` parameter. Where does the DC come from? The LLM decides based on narrative context (moderate task = DC 15, etc.). This is intentional — the LLM is the DM — but means the mechanic is only as good as the LLM's DC judgment. Should the tool log DC choices to `GameEvent` for transparency? Current plan: yes, always log as a `TOOL_RESULT` game event.

- **`prepare_spells` timing**: The spec says after long rest for Wizard/Cleric/Druid. Should the tool validate that a long rest just occurred, or trust the LLM to only call it at appropriate moments? Current plan: trust the LLM; adding temporal validation couples the tool to `inGameDate` bookkeeping unnecessarily.

- **`add_to_party` and world tick**: When an NPC joins the party, their `nextTickInGameDate` should be nulled so they are not processed by the world tick independently. `add_to_party` should update `Npc.partyStatus = COMPANION` and `Npc.nextTickInGameDate = null`. `remove_from_party` should re-set a `nextTickInGameDate` via a Haiku call to resume their agenda. This crosses into `world-system` territory — needs coordination once that change begins.
