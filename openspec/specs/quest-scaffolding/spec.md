# Quest Scaffolding

## Purpose

Defines the LLM tools and logic for creating quests and managing their lifecycle. This spec covers the `create_quest` tool (which atomically scaffolds a quest and its dependent world entities), quest status transitions via `complete_quest` and `fail_quest`, agenda impact application, and objective advancement tools.

## Requirements

### Requirement: create_quest tool atomically scaffolds a quest and all dependent world entities
The system SHALL expose a `create_quest` LLM tool that accepts:
- `campaignId` (string)
- `title` (string)
- `description` (string)
- `agendaImpact` (nullable string) — instructions for how NPC agendas should shift on quest resolution
- `rewardNarrative` (nullable string), `rewardXp` (nullable integer), `rewardGold` (nullable integer)
- `objectives` (array of objective specs: `{ description, type, entityRef? }`)
- `npcs` (nullable array of NPC specs to create)
- `locations` (nullable array of Location specs to create)
- `items` (nullable array of Item specs to create)
- `worldEvents` (nullable array of WorldEvent specs to create)

The tool SHALL execute all persistence operations inside a single MikroORM `em.transactional()` call. On failure the transaction rolls back completely and the tool returns `{ success: false, reason: string }`.

#### Scenario: Quest and all entities are created atomically
- **WHEN** the LLM calls `create_quest` with NPC specs, location specs, and objective definitions
- **THEN** a `Quest`, its `QuestObjective` rows, the specified `Npc`, `Location`, and `QuestEntity` rows are all committed in one transaction

#### Scenario: Partial failure rolls back all entities
- **WHEN** an error occurs during any step of the `create_quest` transaction
- **THEN** no rows from that call are persisted and the tool returns `{ success: false, reason: <message> }`

### Requirement: create_quest links scaffolded entities to the quest via QuestEntity
After creating each world entity, the system SHALL create a corresponding `QuestEntity` row linking that entity to the quest with the appropriate `entityType` and the newly assigned `entityId`.

#### Scenario: Scaffolded NPC is linked via QuestEntity
- **WHEN** `create_quest` creates a new NPC as part of scaffolding
- **THEN** a `QuestEntity` row with `entityType: NPC` and the new NPC's id is persisted

#### Scenario: Scaffolded location is linked via QuestEntity
- **WHEN** `create_quest` creates a new Location as part of scaffolding
- **THEN** a `QuestEntity` row with `entityType: LOCATION` and the new location's id is persisted

### Requirement: create_quest resolves objective entityRefs to scaffolded entity IDs
Objective specs MAY include an `entityRef` that names a scaffolded entity by its spec-level reference key. The system SHALL resolve each `entityRef` to the corresponding newly created entity's `id` and set `QuestObjective.entityId` accordingly.

#### Scenario: REACH_LOCATION objective resolves to scaffolded location id
- **WHEN** an objective spec has `{ type: REACH_LOCATION, entityRef: "dungeon_entrance" }` and a location spec also has key `"dungeon_entrance"`
- **THEN** `QuestObjective.entityId` is set to the id of the newly created location

#### Scenario: NPC_DEAD objective resolves to scaffolded NPC id
- **WHEN** an objective spec has `{ type: NPC_DEAD, entityRef: "boss_npc" }` and an NPC spec has key `"boss_npc"`
- **THEN** `QuestObjective.entityId` is set to the id of the newly created NPC

### Requirement: complete_quest and fail_quest tools resolve a quest and apply agenda impact
The system SHALL expose `complete_quest` and `fail_quest` LLM tools that each accept `questId`. Both tools SHALL:
1. Set `Quest.status` to `COMPLETED` or `FAILED` respectively
2. If `Quest.agendaImpact` is non-null, call `QuestService.applyAgendaImpact()` which invokes the existing `update_npc` path for each linked NPC `QuestEntity`
3. Return the updated quest

#### Scenario: complete_quest sets quest status to COMPLETED
- **WHEN** the LLM calls `complete_quest` for an ACTIVE quest
- **THEN** `Quest.status` is set to COMPLETED

#### Scenario: fail_quest sets quest status to FAILED
- **WHEN** the LLM calls `fail_quest` for an ACTIVE quest
- **THEN** `Quest.status` is set to FAILED

#### Scenario: Agenda impact is applied on quest resolution
- **WHEN** a quest with a non-null `agendaImpact` is completed or failed
- **THEN** `applyAgendaImpact()` is called and each linked NPC's agenda is updated via the existing `update_npc` path

#### Scenario: Missing quest returns structured error
- **WHEN** the LLM calls `complete_quest` or `fail_quest` with a quest id that does not exist
- **THEN** the tool returns `{ success: false, reason: "QUEST_NOT_FOUND" }`

### Requirement: update_quest_objective tool advances MANUAL and TALK_TO_NPC objectives
The system SHALL expose an `update_quest_objective` LLM tool that accepts `objectiveId` and `status` (`INCOMPLETE | COMPLETE`). The tool SHALL apply the status change and return the updated objective.

#### Scenario: MANUAL objective status is updated
- **WHEN** the LLM calls `update_quest_objective` with `{ status: COMPLETE }` for a MANUAL objective
- **THEN** `QuestObjective.status` is set to COMPLETE

#### Scenario: TALK_TO_NPC objective is completed via update_quest_objective
- **WHEN** the LLM calls `update_quest_objective` for a TALK_TO_NPC objective
- **THEN** `QuestObjective.status` is updated to the provided value

#### Scenario: Missing objective returns structured error
- **WHEN** the LLM calls `update_quest_objective` with an id that does not exist
- **THEN** the tool returns `{ success: false, reason: "OBJECTIVE_NOT_FOUND" }`
