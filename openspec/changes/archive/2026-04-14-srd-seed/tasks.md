## 1. SRD Entities

- [x] 1.1 Create `api/src/srd/entities/srd-class.entity.ts` with fields: `index`, `name`, `hitDie`, `proficiencies` (JSONB), `savingThrows` (JSONB), `spellcastingAbility`
- [x] 1.2 Create `api/src/srd/entities/srd-race.entity.ts` with fields: `index`, `name`, `speed`, `abilityBonuses` (JSONB), `traits` (JSONB), `size`
- [x] 1.3 Create `api/src/srd/entities/srd-spell.entity.ts` with fields: `index`, `name`, `level`, `school`, `castingTime`, `range`, `components` (JSONB), `duration`, `description`, `higherLevel`, `classes` (JSONB)
- [x] 1.4 Create `api/src/srd/entities/srd-monster.entity.ts` with fields: `index`, `name`, `size`, `type`, `alignment`, `armorClass`, `hitPoints`, `challengeRating`, `speed` (JSONB), `abilityScores` (JSONB), `actions` (JSONB)
- [x] 1.5 Create `api/src/srd/entities/srd-equipment.entity.ts` with fields: `index`, `name`, `category`, `cost` (JSONB), `weight`, `properties` (JSONB), `damage` (JSONB)
- [x] 1.6 Create `api/src/srd/entities/srd-condition.entity.ts` with fields: `index`, `name`, `description`
- [x] 1.7 Register all six entities in `mikro-orm.config.ts`

## 2. Migration

- [x] 2.1 Run `mikro-orm migration:create` to generate the SRD tables migration
- [x] 2.2 Verify the generated migration SQL creates all six tables with correct column types (JSONB for array/object fields)

## 3. Seeder

- [x] 3.1 Create `api/src/srd/srd.seeder.ts` with a `seedEntityType` helper that: checks count, fetches the list endpoint, batch-fetches detail pages (concurrency cap 10), maps to entity shape, and bulk-inserts
- [x] 3.2 Implement `seedClasses` mapping: `index`, `name`, `hit_die`, `proficiencies` (names array), `saving_throws` (names array), `spellcasting.spellcasting_ability`
- [x] 3.3 Implement `seedRaces` mapping: `index`, `name`, `speed`, `ability_bonuses`, `traits` (names array), `size`
- [x] 3.4 Implement `seedSpells` mapping: `index`, `name`, `level`, `school.name`, `casting_time`, `range`, `components`, `duration`, `desc` (joined), `higher_level` (joined), `classes` (names array)
- [x] 3.5 Implement `seedMonsters` mapping: `index`, `name`, `size`, `type`, `alignment`, `armor_class[0].value`, `hit_points`, `challenge_rating`, `speed`, ability score fields, `actions`
- [x] 3.6 Implement `seedEquipment` mapping: `index`, `name`, `equipment_category.name`, `cost`, `weight`, `properties` (names array), `damage`
- [x] 3.7 Implement `seedConditions` mapping: `index`, `name`, `desc` (joined)
- [x] 3.8 Add error handling: catch fetch errors per entity type, log clearly, continue to next type without throwing
- [x] 3.9 Add a migration step in `Migration20260413000001.ts` (or a new migration) that calls the seeder after schema creation

## 4. SrdModule and GraphQL Resolvers

- [x] 4.1 Create `api/src/srd/srd.module.ts` with providers for each resolver and the six entity repositories
- [x] 4.2 Create `api/src/srd/srd-class.resolver.ts` with `srdClasses` and `srdClass(index)` queries
- [x] 4.3 Create `api/src/srd/srd-race.resolver.ts` with `srdRaces` and `srdRace(index)` queries
- [x] 4.4 Create `api/src/srd/srd-spell.resolver.ts` with `srdSpells(search, level, school)` and `srdSpell(index)` queries
- [x] 4.5 Create `api/src/srd/srd-monster.resolver.ts` with `srdMonsters(search, minCr, maxCr)` and `srdMonster(index)` queries
- [x] 4.6 Create `api/src/srd/srd-equipment.resolver.ts` with `srdEquipment(search, category)` and `srdEquipmentItem(index)` queries
- [x] 4.7 Create `api/src/srd/srd-condition.resolver.ts` with `srdConditions` and `srdCondition(index)` queries
- [x] 4.8 Register `SrdModule` in `AppModule`

## 5. Tests

- [x] 5.1 Write unit tests for the seeder mapping functions (input fixture → expected entity shape) for each of the six entity types
- [x] 5.2 Write unit tests for resolver filter logic (level filter, CR range filter, name search)
- [x] 5.3 Write an integration test that runs the seeder against a real PostgreSQL test database and asserts row counts > 0 for each entity type
- [x] 5.4 Write an integration test that queries `srdSpell(index: "fireball")` via the resolver and asserts correct fields are returned
