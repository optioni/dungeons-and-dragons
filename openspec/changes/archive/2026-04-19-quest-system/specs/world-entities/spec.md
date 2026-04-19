## ADDED Requirements

### Requirement: NPCs, Locations, Items, and WorldEvents may be linked to quests via QuestEntity
The system SHALL support application-level references from `QuestEntity` rows to `Npc`, `Location`, `Item`, and `WorldEvent` entities using `entityType` and `entityId`. No foreign-key constraints are required. The referenced entities SHALL continue to function independently if their associated quest is completed or failed.

#### Scenario: Quest scaffold creates NPC linked via QuestEntity
- **WHEN** `create_quest` creates a new NPC as part of quest scaffolding
- **THEN** a `QuestEntity` row with `entityType: NPC` referencing that NPC's id is persisted alongside the NPC

#### Scenario: Quest scaffold creates Location linked via QuestEntity
- **WHEN** `create_quest` creates a new Location as part of quest scaffolding
- **THEN** a `QuestEntity` row with `entityType: LOCATION` referencing that location's id is persisted

#### Scenario: Quest scaffold creates Item linked via QuestEntity
- **WHEN** `create_quest` creates a new Item as part of quest scaffolding
- **THEN** a `QuestEntity` row with `entityType: ITEM` referencing that item's id is persisted

#### Scenario: Quest scaffold creates WorldEvent linked via QuestEntity
- **WHEN** `create_quest` creates a new WorldEvent as part of quest scaffolding
- **THEN** a `QuestEntity` row with `entityType: WORLD_EVENT` referencing that event's id is persisted

#### Scenario: Entity remains valid after quest resolution
- **WHEN** a quest is completed or failed
- **THEN** the Npc, Location, Item, and WorldEvent rows linked via QuestEntity continue to exist and operate independently
