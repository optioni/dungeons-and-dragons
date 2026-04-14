## ADDED Requirements

### Requirement: SRD entities exist as read-only MikroORM entities
The system SHALL provide six MikroORM entity classes — `SrdClass`, `SrdRace`, `SrdSpell`, `SrdMonster`, `SrdEquipment`, and `SrdCondition` — each with an `index` (slug) primary identifier and the fields required by the game engine and character creation system. These entities SHALL NOT expose any create/update/delete operations.

`SrdClass` fields: `index`, `name`, `hitDie`, `proficiencies` (JSONB), `savingThrows` (JSONB), `spellcastingAbility` (nullable string).

`SrdRace` fields: `index`, `name`, `speed`, `abilityBonuses` (JSONB), `traits` (JSONB), `size`.

`SrdSpell` fields: `index`, `name`, `level`, `school`, `castingTime`, `range`, `components` (JSONB), `duration`, `description`, `higherLevel` (nullable), `classes` (JSONB).

`SrdMonster` fields: `index`, `name`, `size`, `type`, `alignment`, `armorClass`, `hitPoints`, `challengeRating`, `speed` (JSONB), `abilityScores` (JSONB), `actions` (JSONB).

`SrdEquipment` fields: `index`, `name`, `category`, `cost` (JSONB), `weight` (nullable), `properties` (JSONB), `damage` (nullable JSONB).

`SrdCondition` fields: `index`, `name`, `description`.

#### Scenario: Entity registration in MikroORM config
- **WHEN** the application starts
- **THEN** all six SRD entity classes are registered in the MikroORM entity list and their tables exist after migration

#### Scenario: No mutations exposed
- **WHEN** a caller attempts to modify, create, or delete any SRD row via the application layer
- **THEN** no such operation is available (no GraphQL mutations, no service write methods)

---

### Requirement: SRD seeder fetches data from dnd5eapi.co on first migration
The system SHALL include a `SrdSeeder` that fetches all six resource types from `https://www.dnd5eapi.co/api` and inserts the mapped rows. The seeder SHALL be invoked automatically as part of `mikro-orm migration:up` via an explicit migration step.

The seeder SHALL use a concurrency cap of 10 simultaneous HTTP requests per resource type to avoid overloading the public API.

#### Scenario: Seeder runs on clean database
- **WHEN** `migration:up` is run against a database with empty SRD tables
- **THEN** all six SRD tables are populated with rows fetched from dnd5eapi.co

#### Scenario: Seeder is idempotent
- **WHEN** the seeder runs and any SRD table already contains rows
- **THEN** that entity type is skipped (no duplicate inserts, no errors)

#### Scenario: Seeder logs progress
- **WHEN** the seeder fetches each resource type
- **THEN** a log line records the resource name and row count inserted (or "skipped — already seeded")

---

### Requirement: Seeder handles dnd5eapi.co unavailability gracefully
The system SHALL log a clear error message and allow the migration to complete (schema created) if the remote API is unreachable during seeding. SRD tables will be empty; the operator SHALL be instructed to re-run `migration:up` once connectivity is restored.

#### Scenario: API unreachable during seed
- **WHEN** dnd5eapi.co is unreachable during `migration:up`
- **THEN** the migration completes without throwing, SRD tables are empty, and a logged error explains how to re-seed

#### Scenario: Partial API failure
- **WHEN** fetching one resource type fails but others succeed
- **THEN** successfully fetched entity types are persisted and the failed type is logged with an error; other entity types are not rolled back

---

### Requirement: GraphQL queries expose SRD data for character creation and game engine
The system SHALL expose the following GraphQL queries in a `SrdModule`:

- `srdClasses: [SrdClass!]!` — all classes
- `srdClass(index: String!): SrdClass` — single class by index slug
- `srdRaces: [SrdRace!]!` — all races
- `srdRace(index: String!): SrdRace` — single race by index slug
- `srdSpells(search: String, level: Int, school: String): [SrdSpell!]!` — filtered spell list
- `srdSpell(index: String!): SrdSpell` — single spell by index slug
- `srdMonsters(search: String, minCr: Float, maxCr: Float): [SrdMonster!]!` — filtered monster list
- `srdMonster(index: String!): SrdMonster` — single monster by index slug
- `srdEquipment(search: String, category: String): [SrdEquipment!]!` — filtered equipment list
- `srdEquipmentItem(index: String!): SrdEquipment` — single equipment item by index slug
- `srdConditions: [SrdCondition!]!` — all conditions
- `srdCondition(index: String!): SrdCondition` — single condition by index slug

#### Scenario: List query returns all records
- **WHEN** `srdClasses` is queried with no arguments
- **THEN** all seeded class records are returned

#### Scenario: Single lookup by index
- **WHEN** `srdSpell(index: "fireball")` is queried
- **THEN** the spell with index "fireball" is returned, or null if not found

#### Scenario: Spell list filtered by level
- **WHEN** `srdSpells(level: 3)` is queried
- **THEN** only spells of level 3 are returned

#### Scenario: Monster list filtered by CR range
- **WHEN** `srdMonsters(minCr: 1, maxCr: 5)` is queried
- **THEN** only monsters with challenge rating between 1 and 5 inclusive are returned

#### Scenario: Search filter on name
- **WHEN** `srdSpells(search: "fire")` is queried
- **THEN** spells whose names contain "fire" (case-insensitive) are returned

---

### Requirement: SrdModule is registered in AppModule
The system SHALL register `SrdModule` in `AppModule` so that all SRD GraphQL queries are available at the application's GraphQL endpoint.

#### Scenario: SRD queries available at runtime
- **WHEN** the NestJS application starts with `SrdModule` registered
- **THEN** introspecting the GraphQL schema includes the SRD query fields
