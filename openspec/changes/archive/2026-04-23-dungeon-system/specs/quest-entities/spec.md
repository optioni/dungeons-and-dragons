## ADDED Requirements

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
