## 1. Database — Entities and Migration

- [ ] 1.1 Create `Character` entity (`apps/api/src/character/entities/character.entity.ts`) with all fields: name, level, abilityScores (jsonb), hp, maxHp, ac, conditions (text[]), spellSlots (jsonb), preparedSpells (text[]), skillProficiencies (jsonb), goldPieces, silverPieces, copperPieces, xp, deathSaveSuccesses, deathSaveFailures, isDead; ManyToOne → SrdRace, SrdClass; ManyToOne → Campaign (raw FK until CampaignModule exists)
- [ ] 1.2 Create `Item` entity (`apps/api/src/character/entities/item.entity.ts`) with name, description, weight, value, itemType enum, nullable ManyToOne → SrdEquipment
- [ ] 1.3 Create `CharacterItem` entity (`apps/api/src/character/entities/character-item.entity.ts`) with ManyToOne → Character, ManyToOne → Item, slot (EquipSlot enum, nullable), condition (text, nullable)
- [ ] 1.4 Generate MikroORM migration for `character`, `item`, `character_item` tables
- [ ] 1.5 Add unique partial index on `character_item(character_id, slot)` WHERE slot IS NOT NULL (in migration file)

## 2. CharacterModule Scaffold

- [ ] 2.1 Create `CharacterModule` (`apps/api/src/character/character.module.ts`) importing MikroORM entities, exporting `CharacterService`
- [ ] 2.2 Register `CharacterModule` in `AppModule`
- [ ] 2.3 Create `CharacterService` stub (`apps/api/src/character/character.service.ts`) with empty method signatures for all operations

## 3. Character Creation Service Logic

- [ ] 3.1 Write unit test for ability score standard-array validation (must be a permutation of [15,14,13,12,10,8])
- [ ] 3.2 Implement `validateAbilityScores` in `CharacterService`
- [ ] 3.3 Write unit test for initial HP calculation (hit die + CON modifier)
- [ ] 3.4 Implement initial character state derivation in `CharacterService.create`: hp/maxHp from class hitDie + CON modifier, ac = 10 + DEX modifier, spellSlots from SRD class data at level 1, skillProficiencies initialized from class/race proficiencies
- [ ] 3.5 Write unit test for `proficiencyBonus` computation (floor((level-1)/4)+2)
- [ ] 3.6 Implement `getProficiencyBonus(level)` helper in `CharacterService`

## 4. Character GraphQL — Queries and Mutations

- [ ] 4.1 Create `CreateCharacterInput` DTO with name, raceId, classId, abilityScores sub-input (STR/DEX/CON/INT/WIS/CHA)
- [ ] 4.2 Create `Character` GraphQL ObjectType in entity (add `@ObjectType` / `@Field` decorators); include computed `proficiencyBonus` field resolved inline
- [ ] 4.3 Create `CharacterResolver` with `createCharacter` mutation (authenticated, calls `CharacterService.create`)
- [ ] 4.4 Add `character(id: ID!)` query to `CharacterResolver` (authenticated, verified campaign owner)
- [ ] 4.5 Implement `updateCharacterState` internal service method accepting partial Character update payload (not exposed as GraphQL mutation)

## 5. Inventory Service Logic

- [ ] 5.1 Write unit test for slot-vacancy check (equipping to an occupied slot fails)
- [ ] 5.2 Implement `CharacterService.equipItem(characterItemId, slot)`: verify ownership, check slot vacancy inside a transaction, assign slot
- [ ] 5.3 Implement `CharacterService.unequipItem(characterItemId)`: verify ownership, set slot to null
- [ ] 5.4 Implement `CharacterService.getInventory(characterId)`: verify ownership, return CharacterItem list with nested Item

## 6. Inventory GraphQL — Queries and Mutations

- [ ] 6.1 Create `Item` GraphQL ObjectType (add `@ObjectType` / `@Field` decorators)
- [ ] 6.2 Create `CharacterItem` GraphQL ObjectType with slot, condition, nested item field
- [ ] 6.3 Add `characterInventory(characterId: ID!)` query to `CharacterResolver` (authenticated, campaign owner)
- [ ] 6.4 Add `equipItem(characterItemId: ID!, slot: EquipSlot!)` mutation (authenticated, campaign owner); return structured error on slot conflict
- [ ] 6.5 Add `unequipItem(characterItemId: ID!)` mutation (authenticated, campaign owner)

## 7. Integration Tests

- [ ] 7.1 Write integration test for `createCharacter` with valid standard array → character persisted with correct initial state
- [ ] 7.2 Write integration test for `createCharacter` with invalid ability scores → validation error, no row created
- [ ] 7.3 Write integration test for `equipItem` → slot assigned; second equip to same slot → error
- [ ] 7.4 Write integration test for `unequipItem` → slot cleared, item remains in inventory
- [ ] 7.5 Write integration test for non-owner access → forbidden error on character query and inventory mutations

## 8. Web — Character Creation Wizard

- [ ] 8.1 Create page `apps/web/pages/campaign/[id]/setup.vue` with a 4-step wizard: name → race → class → ability scores
- [ ] 8.2 Implement step 1: text input for character name with validation (non-empty)
- [ ] 8.3 Implement step 2: race selection using `srdRaces` query, display name and traits
- [ ] 8.4 Implement step 3: class selection using `srdClasses` query, display name and hit die
- [ ] 8.5 Implement step 4: ability score assignment UI — show standard array values [15,14,13,12,10,8] as draggable/selectable tokens; each value can only be assigned once; all six scores must be assigned before submit is enabled
- [ ] 8.6 On wizard submit call `createCharacter` mutation; on success redirect to `/campaign/[id]`

## 9. Web — Character Sheet Page

- [ ] 9.1 Create page `apps/web/pages/campaign/[id]/character.vue` — query `character` and `characterInventory` on mount
- [ ] 9.2 Render ability scores section: display each score with computed modifier (e.g., STR 15 (+2))
- [ ] 9.3 Render core stats section: HP/maxHP, AC, proficiency bonus, level, XP, conditions
- [ ] 9.4 Render spell slots section (only when `spellSlots` array is non-empty): show each slot level with used/total pips; render prepared spells list
- [ ] 9.5 Render skill proficiencies section: list all 18 skills with proficiency status indicator
- [ ] 9.6 Render inventory section: list CharacterItem rows with item name, type, slot label or "Carried", condition; add unequip button for equipped items
- [ ] 9.7 Render currency section: display goldPieces / silverPieces / copperPieces
