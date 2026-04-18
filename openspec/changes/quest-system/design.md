## Context

The app has a `GameEngineModule` with a `GameEngineToolRegistrar` that registers LLM tool handlers. World entities (Npc, Location, Item) already exist across `WorldModule` and `CharacterModule`. The quest system adds three new entities (Quest, QuestObjective, QuestEntity), four new LLM tools, and an auto-checker that runs after every state-changing tool call.

There are no existing quest entities or quest-related GraphQL types. The `Campaign` entity stores `inGameDate` as a narrative string. NPC `agenda` and `nextTickInGameDate` fields are already in place. The game engine currently has no hook point for post-tool side effects.

## Goals / Non-Goals

**Goals:**
- Three new entities: `Quest`, `QuestObjective`, `QuestEntity` with GraphQL types and relay-paginated queries
- `create_quest` LLM tool that atomically scaffolds quest + all dependent entities (locations, NPCs, items, world events) and links them via `QuestEntity`
- `complete_quest` and `fail_quest` tools that apply rewards and update NPC agendas via `agendaImpact`
- `update_quest_objective` tool for advancing `MANUAL` objectives
- Auto-checker: runs an indexed query against `QuestObjective` after each state-changing tool call; notifies the LLM when all objectives of a quest are met
- Quests page in web (`/campaign/[id]/quests`) showing active and completed quests with objective checklists

**Non-Goals:**
- Multi-stage quest branching (e.g. quest trees with conditional paths) — quests are flat objective lists
- Time-based quest expiry or failure — only explicit `fail_quest` calls fail a quest
- Quest sharing across campaigns or characters
- Editing quest objectives after creation

## Decisions

### 1. New `QuestModule` rather than expanding `GameEngineModule`

A dedicated `QuestModule` owns the `Quest`, `QuestObjective`, and `QuestEntity` entities plus the `QuestService` and `QuestResolver`. `GameEngineModule` imports `QuestModule` to get `QuestService` for the auto-checker and tool registrar.

**Why:** `GameEngineModule` is already large. Quest entities have their own lifecycle independent of mechanics (the web UI reads them without triggering tools). Keeping them separate follows the existing pattern where `WorldMutationService` lives in `GameEngineModule` but `WorldModule` owns the world entities.

**Alternative considered:** Embed quests directly in `GameEngineModule`. Rejected because it mixes data ownership with mechanics.

### 2. Polymorphic `QuestEntity` join table (entityType + entityId)

`QuestEntity` has `questId`, `entityType: enum(NPC, LOCATION, ITEM, WORLD_EVENT)`, and `entityId: integer`. No foreign key constraints — just an application-level reference.

**Why:** Avoids four separate join tables (QuestNpc, QuestLocation, etc.) while keeping the schema flat. The set of entity types is closed and controlled by the server. The trade-off (no DB-level referential integrity) is acceptable since entity deletion is rare and quest scaffolding creates entities atomically.

**Alternative considered:** Separate join tables per entity type with real FK constraints. Rejected as over-engineered for four fixed types.

### 3. Auto-checker via `QuestService` injected into `GameEngineToolRegistrar`

`GameEngineToolRegistrar` receives `QuestService` as a constructor dependency. A private `runQuestAutoChecker(campaignId)` helper is called at the end of each state-changing tool's `execute` handler: `travel_to`, `apply_damage`, `give_item`, `update_npc`.

The checker queries:
```sql
SELECT qo.* FROM quest_objective qo
JOIN quest q ON q.id = qo.quest_id
WHERE q.campaign_id = $1 AND q.status = 'ACTIVE' AND qo.status = 'INCOMPLETE'
```
Then evaluates each incomplete objective against the current world state. When all objectives of a quest complete, it returns a `questCompleted` signal in the `ToolResult` so the LLM can narrate the completion.

**Why:** Inline injection avoids a separate event bus. The indexed query is lightweight (campaign-scoped, status-filtered). Returning the signal in `ToolResult` is consistent with how the existing tool contract works.

**Alternative considered:** Domain events / EventEmitter2. Rejected as adding infrastructure complexity for a single use case.

### 4. `create_quest` scaffolds entities atomically in a MikroORM transaction

The `create_quest` tool accepts a full description of needed entities (NPC specs, location specs, item specs, world event specs) plus objective definitions. `QuestService.createQuest()` wraps everything in `em.transactional()`: creates all entities, persists them, creates `QuestEntity` links, creates `QuestObjective` rows.

**Why:** Partial scaffolding leaves orphaned entities and broken objective references. Atomic creation or full rollback is simpler for error recovery — the LLM gets a clear success/failure with no cleanup needed.

### 5. Quest status enum: `ACTIVE | COMPLETED | FAILED`

Quests start as `ACTIVE`. Only `complete_quest` and `fail_quest` tools change status. The auto-checker never directly marks a quest complete — it signals the LLM, which must then call `complete_quest`.

**Why:** Keeps the LLM in control of narrative pacing. Auto-checker fires when *objectives* are all met, but the LLM decides when to formally close the quest (it may want to narrate a cutscene first).

**Alternative considered:** Auto-checker auto-completes the quest. Rejected because it bypasses narrative control.

### 6. `agendaImpact` stored on Quest, applied on completion/failure

`Quest` stores `agendaImpact: string | null` — a short instruction for how NPCs' agendas should shift when the quest resolves. `complete_quest` / `fail_quest` call `QuestService.applyAgendaImpact()` which calls the existing `update_npc` logic for each linked NPC `QuestEntity`.

**Why:** Reuses the existing `update_npc` path rather than duplicating NPC mutation logic.

## Risks / Trade-offs

- **Auto-checker latency per tool call** → Mitigated by a composite index on `(quest_id, status)` on `QuestObjective` and `(campaign_id, status)` on `Quest`. The query is bounded by campaign scope.

- **No FK constraints on QuestEntity.entityId** → If a linked NPC/Location is deleted, the QuestEntity row becomes a dangling reference. Mitigation: entity deletion is not a supported operation during play; quests are always resolved before a campaign ends.

- **Atomic scaffolding can create many rows in one transaction** → A complex quest could create 3–5 locations, 5–10 NPCs, several items, and world events in one call. Mitigation: MikroORM's identity map batches inserts; the LLM is instructed to keep scaffolding lean.

- **TALK_TO_NPC objectives require detecting dialogue events** → The auto-checker for `TALK_TO_NPC` needs a signal from the session layer (a `GameEvent` of type `NPC_DIALOGUE`). This adds a dependency on `SessionModule`. → Mitigation: `TALK_TO_NPC` objectives are only completable via explicit `update_quest_objective` calls (treated like `MANUAL`) until a dialogue event hook is in place.

## Migration Plan

1. Create MikroORM migration adding tables: `quest`, `quest_objective`, `quest_entity`
2. Add indexes: `quest(campaign_id, status)`, `quest_objective(quest_id, status)`, `quest_entity(quest_id)`, `quest_entity(entity_type, entity_id)`
3. No data migration required — all tables are new
4. Rollback: drop the three tables and their indexes

## Open Questions

- Should `TALK_TO_NPC` be auto-checked via a `GameEvent` hook, or remain `MANUAL`-only for now? (Proposed: `MANUAL`-only for v1, upgrade later)
- Should quest rewards (gold, XP, items) be structured data or a free-text narrative hint for the LLM to interpret? (Proposed: free-text `rewardNarrative` + optional structured `rewardXp: int` and `rewardGold: int`)
