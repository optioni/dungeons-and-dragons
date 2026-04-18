## ADDED Requirements

### Requirement: Dungeon entity persists dungeon metadata
The system SHALL persist a `Dungeon` entity with fields: `id`, `campaignId` (FK → Campaign), `name` (string), `description` (string), `totalFloors` (int, default 1), and `encounterTable` (jsonb, nullable — array of `{ weight: number, monsters: MonsterSpec[] }`). A `Dungeon` SHALL belong to exactly one `Campaign`.

#### Scenario: Dungeon is created with required fields
- **WHEN** the DM calls `create_dungeon` with a valid `campaignId`, `name`, and `description`
- **THEN** a `Dungeon` row is persisted with those values and `encounterTable` defaulting to null

#### Scenario: Dungeon with encounter table is persisted
- **WHEN** the DM calls `create_dungeon` with a non-null `encounterTable`
- **THEN** the JSON is stored as-is and returned in subsequent queries

### Requirement: Rooms are Location rows scoped to a Dungeon
The system SHALL add three nullable columns to `Location`: `dungeonId` (FK → Dungeon), `floor` (integer), and `roomState` (enum: `UNEXPLORED | EXPLORED | CLEARED | LOCKED | TRAPPED`). A `Location` with a non-null `dungeonId` is a dungeon room. `roomState` SHALL default to `UNEXPLORED` for all dungeon rooms. World-scale locations SHALL have `dungeonId = null`.

#### Scenario: Room locations are scoped to their dungeon
- **WHEN** dungeon rooms are queried for a campaign
- **THEN** only `Location` rows with a matching `dungeonId` are returned

#### Scenario: World locations are unaffected
- **WHEN** world-scale locations are queried
- **THEN** only `Location` rows with `dungeonId = null` are returned

### Requirement: RoomEncounter entity stores pre-stocked keyed encounters
The system SHALL persist `RoomEncounter` with fields: `id`, `roomId` (FK → Location), `description` (string), `cleared` (boolean, default false), and `monsters` (jsonb — array of `{ srdIndex?: string, name: string, count: number, hp?: number }`). A room MAY have zero or one `RoomEncounter`.

#### Scenario: Room encounter is created for a room
- **WHEN** `create_dungeon` includes an encounter spec for a room
- **THEN** a `RoomEncounter` row is persisted linked to that room's Location id

#### Scenario: Cleared encounter persists across sessions
- **WHEN** a `RoomEncounter` has `cleared = true`
- **THEN** subsequent queries for that room return the encounter with `cleared = true`

### Requirement: RoomItem entity stores pre-placed treasure
The system SHALL persist `RoomItem` with fields: `roomId` (FK → Location), `itemId` (FK → Item), `quantity` (int, default 1), and `containerName` (string, nullable). Multiple `RoomItem` rows MAY share the same `roomId`.

#### Scenario: Room item is linked to a room and an item
- **WHEN** `add_room_item` is called with a valid room and item id
- **THEN** a `RoomItem` row is persisted with the correct room, item, and quantity

#### Scenario: Container name is optional
- **WHEN** `add_room_item` is called without a `containerName`
- **THEN** the row is persisted with `containerName = null`

### Requirement: Dungeon and room data are queryable via GraphQL
The system SHALL expose relay-paginated GraphQL queries for `Dungeon` (by campaign) and `RoomEncounter` (by dungeon). Individual dungeon rooms SHALL be queryable as `Location` rows filtered by `dungeonId`. All queries SHALL be scoped to the authenticated campaign owner.

#### Scenario: Dungeons for a campaign are relay-paginated
- **WHEN** the owner queries dungeons for their campaign
- **THEN** a relay `DungeonConnection` is returned with `edges`, `pageInfo`, and cursor-based pagination

#### Scenario: Room encounters for a dungeon are queryable
- **WHEN** the owner queries encounters for a dungeon
- **THEN** only `RoomEncounter` rows linked to rooms of that dungeon are returned
