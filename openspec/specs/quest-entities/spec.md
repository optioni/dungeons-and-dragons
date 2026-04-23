# Quest Entities

## Purpose

Defines the campaign-scoped quest system that tracks player objectives and goals. This spec covers the persistent quest data model (`Quest`, `QuestObjective`, `QuestEntity`), quest lifecycle, indexing for efficient querying, and the GraphQL API for quest access.

## Requirements

### Requirement: Quest entity persists campaign-scoped quest state
The system SHALL persist a `Quest` entity with the following fields: `id`, `campaignId`, `title`, `description`, `status` (enum: `ACTIVE | COMPLETED | FAILED`), `agendaImpact` (nullable string), `rewardNarrative` (nullable string), `rewardXp` (nullable integer), `rewardGold` (nullable integer), and `createdAt`. Quests SHALL always start with `status: ACTIVE`.

#### Scenario: Quest is created with ACTIVE status
- **WHEN** a new Quest is persisted
- **THEN** `Quest.status` is `ACTIVE`

#### Scenario: Quest is scoped to a campaign
- **WHEN** a quest is created for a campaign
- **THEN** `Quest.campaignId` references that campaign and the quest is not visible to other campaigns

### Requirement: QuestObjective entity tracks individual quest goals
The system SHALL persist a `QuestObjective` entity with fields: `id`, `questId`, `description`, `type` (enum: `REACH_LOCATION | NPC_DEAD | NPC_ALIVE | HAVE_ITEM | TALK_TO_NPC | MANUAL`), `status` (enum: `INCOMPLETE | COMPLETE`), `entityId` (nullable integer — references the entity to check), and `order` (integer for display ordering). `QuestObjective.status` SHALL default to `INCOMPLETE`.

#### Scenario: QuestObjective is created with INCOMPLETE status
- **WHEN** a `QuestObjective` row is inserted
- **THEN** `QuestObjective.status` is `INCOMPLETE`

#### Scenario: QuestObjective links to a target entity via entityId
- **WHEN** a `QuestObjective` has type `NPC_DEAD` and `entityId` is set
- **THEN** `entityId` refers to an `Npc.id` that the auto-checker evaluates

### Requirement: QuestEntity join table links quests to world entities
The system SHALL persist a `QuestEntity` join table with fields: `id`, `questId`, `entityType` (enum: `NPC | LOCATION | ITEM | WORLD_EVENT | DUNGEON`), and `entityId` (integer — application-level reference, no FK constraint). A quest MAY have zero or more `QuestEntity` rows.

#### Scenario: QuestEntity row references an NPC
- **WHEN** a `QuestEntity` with `entityType: NPC` and a valid `entityId` is persisted
- **THEN** the quest is considered linked to that NPC for agenda impact and objective resolution

#### Scenario: QuestEntity stores no FK constraint
- **WHEN** the `quest_entity` table is created
- **THEN** `entityId` has no foreign-key constraint to any other table

### Requirement: QuestEntity supports DUNGEON entity type
The system SHALL extend the `QuestEntity.entityType` enum with a `DUNGEON` value. A `QuestEntity` with `entityType = DUNGEON` SHALL reference a `Dungeon` id in `entityId`. This allows quests to link to dungeons as first-class quest-tracked entities.

#### Scenario: Quest can be linked to a dungeon
- **WHEN** `create_quest` is called with a `dungeonId`
- **THEN** a `QuestEntity` row is created with `entityType = DUNGEON` and `entityId = dungeonId` in the same transaction

#### Scenario: DUNGEON quest entity references a valid dungeon
- **WHEN** `create_quest` is called with a `dungeonId` that does not belong to the campaign
- **THEN** the transaction is rolled back and the tool returns `errorCode: DUNGEON_NOT_FOUND`

### Requirement: create_quest accepts an optional dungeonId reference
The system SHALL extend the `create_quest` LLM tool to accept an optional `dungeonId` parameter. When provided, `create_quest` SHALL validate the dungeon belongs to the campaign and SHALL create a `QuestEntity(type=DUNGEON, entityId=dungeonId)` within the same atomic transaction. When omitted, quest creation SHALL proceed unchanged.

#### Scenario: Quest created with dungeonId links to the dungeon
- **WHEN** `create_quest` is called with a valid `dungeonId`
- **THEN** a `QuestEntity` with `entityType = DUNGEON` is persisted in the same transaction as the quest

#### Scenario: Quest created without dungeonId proceeds normally
- **WHEN** `create_quest` is called without a `dungeonId`
- **THEN** the quest and its other entities are created as before, with no `DUNGEON` QuestEntity row

### Requirement: Quest GraphQL queries expose campaign-scoped quest data
The system SHALL expose authenticated, owner-scoped GraphQL queries:
- `quests(campaignId, status?, first, after)` — relay-paginated list of quests for a campaign, filterable by `status`
- `quest(id)` — single quest with its objectives and linked entities

List queries SHALL use the shared relay pagination helpers from `apps/api/src/graphql/relay/`.

#### Scenario: Owner can list active quests for their campaign
- **WHEN** the campaign owner queries `quests(campaignId, status: ACTIVE)`
- **THEN** only `ACTIVE` quests belonging to that campaign are returned

#### Scenario: Non-owner cannot read another campaign's quests
- **WHEN** a user queries `quests` for a campaign they do not own
- **THEN** the system returns a forbidden or not-found result

#### Scenario: Quest query uses relay pagination shape
- **WHEN** a caller queries `quests(first: 5, after: <cursor>)`
- **THEN** the response includes `edges`, `node`, and `pageInfo` in standard relay format

### Requirement: Database indexes support efficient quest queries
The system SHALL create the following indexes on migration:
- Composite index on `quest(campaign_id, status)` for auto-checker and status-filtered list queries
- Composite index on `quest_objective(quest_id, status)` for auto-checker evaluation
- Index on `quest_entity(quest_id)` for cascade lookups
- Composite index on `quest_entity(entity_type, entity_id)` for reverse lookups

#### Scenario: Quest auto-checker query uses campaign_id and status index
- **WHEN** the auto-checker queries `QuestObjective` rows for a campaign's active quests
- **THEN** the query uses the composite indexes and does not require a full table scan
