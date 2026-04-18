# Character CRUD

## Purpose

Defines how player characters are created, stored, queried, and updated. Covers the Character entity, creation rules (standard ability score array, race/class initialization), the read-only character sheet query, and the internal state-update mechanism used by the game engine.

## Requirements

### Requirement: Character entity stores all mechanical state
The system SHALL persist a `Character` entity associated with a `Campaign`, storing: race (FK → SrdRace), class (FK → SrdClass), name, level, abilityScores (jsonb), hp, maxHp, ac, conditions (text array), spellSlots (jsonb), preparedSpells (text array), skillProficiencies (jsonb), goldPieces, silverPieces, copperPieces, xp, deathSaveSuccesses, deathSaveFailures, isDead. The `proficiencyBonus` SHALL be derived from level and returned as a computed GraphQL field (not stored).

#### Scenario: Character is persisted with all required fields
- **WHEN** a character is created via `createCharacter` mutation with valid inputs
- **THEN** the character row is written to the database with all provided fields and the FK references to SrdRace and SrdClass resolve correctly

#### Scenario: Proficiency bonus is computed from level
- **WHEN** a character at level 5 is queried
- **THEN** the `proficiencyBonus` field returns 3 (computed as `floor((level - 1) / 4) + 2`)

#### Scenario: Character belongs to a campaign
- **WHEN** a character is created
- **THEN** it is associated with the specified campaign and cannot be accessed by a user who does not own that campaign

### Requirement: Character creation uses the standard ability score array
The `createCharacter` mutation SHALL accept a name, raceId, classId, and an `abilityScores` input with STR, DEX, CON, INT, WIS, CHA values. The six values MUST be a permutation of [15, 14, 13, 12, 10, 8]. The mutation SHALL reject any other distribution.

#### Scenario: Valid standard array is accepted
- **WHEN** `createCharacter` is called with abilityScores summing to a valid permutation of [15, 14, 13, 12, 10, 8]
- **THEN** the character is created successfully

#### Scenario: Non-standard array is rejected
- **WHEN** `createCharacter` is called with abilityScores [18, 18, 18, 18, 18, 18]
- **THEN** the mutation returns a validation error and no character is created

#### Scenario: Partial array is rejected
- **WHEN** `createCharacter` is called with fewer than 6 ability score values
- **THEN** the mutation returns a validation error

### Requirement: Initial character state is derived from race and class
When a character is created, the system SHALL initialize: `maxHp` from class hit die + CON modifier, `hp` equal to `maxHp`, `ac` to 10 + DEX modifier, `spellSlots` from class spellcasting table at level 1 (empty array for non-spellcasting classes), `skillProficiencies` with class and race starting proficiencies set to `"proficient"` and all others to `"none"`, `level` to 1, `xp` to 0, `conditions` to empty array, `deathSaveSuccesses` and `deathSaveFailures` to 0, `isDead` to false.

#### Scenario: Fighter (non-caster) starts with empty spell slots
- **WHEN** a character is created with class Fighter (hitDie 10, no spellcastingAbility)
- **THEN** `spellSlots` is `[]` and `preparedSpells` is `[]`

#### Scenario: Wizard starts with level-1 spell slots
- **WHEN** a character is created with class Wizard
- **THEN** `spellSlots` contains an entry `{ level: 1, total: 2, used: 0 }` (as per SRD Wizard level 1)

#### Scenario: HP is initialized from class hit die and CON modifier
- **WHEN** a Fighter is created with CON 14 (modifier +2)
- **THEN** `maxHp` is 12 (10 + 2) and `hp` equals `maxHp`

### Requirement: Character sheet query returns full character state
The system SHALL expose a `character(id: ID!)` GraphQL query (authenticated, campaign-owner only) returning the Character with all fields including computed `proficiencyBonus`, resolved `race` (SrdRace), and resolved `class` (SrdClass).

#### Scenario: Owner can query their character
- **WHEN** a user who owns the campaign queries `character(id: <id>)`
- **THEN** the full character sheet is returned including resolved race and class objects

#### Scenario: Non-owner cannot query a character
- **WHEN** a user queries `character(id: <id>)` for a character in another user's campaign
- **THEN** a not-found or forbidden error is returned

#### Scenario: Character sheet includes computed proficiency bonus
- **WHEN** the character sheet is queried for a level 9 character
- **THEN** `proficiencyBonus` returns 4

### Requirement: Character state can be updated by the game engine
The system SHALL expose an internal `updateCharacterState` service method (not a public GraphQL mutation) that accepts a partial update payload and applies it to the character. This is called exclusively by game engine tool call handlers. Fields that may be updated: `hp`, `maxHp`, `ac`, `conditions`, `spellSlots`, `preparedSpells`, `skillProficiencies`, `xp`, `level`, `deathSaveSuccesses`, `deathSaveFailures`, `isDead`, `goldPieces`, `silverPieces`, `copperPieces`.

#### Scenario: HP is updated after taking damage
- **WHEN** the game engine calls `updateCharacterState` with `{ hp: 5 }` for a character at 12 HP
- **THEN** the character's `hp` is persisted as 5

#### Scenario: Character is marked dead when isDead is set
- **WHEN** the game engine calls `updateCharacterState` with `{ isDead: true }`
- **THEN** the character's `isDead` flag is true in subsequent queries

#### Scenario: Partial update does not clear unspecified fields
- **WHEN** the game engine calls `updateCharacterState` with only `{ hp: 7 }`
- **THEN** all other fields remain unchanged

### Requirement: Web character creation wizard at /campaign/[id]/setup
The web application SHALL provide a multi-step character creation wizard at `/campaign/[id]/setup` with steps: (1) enter name, (2) choose race from SrdRace list, (3) choose class from SrdClass list, (4) assign ability scores using the standard array. Completing the wizard SHALL call `createCharacter` and then hand off to the next stage of the campaign setup flow on the same route, unless no further setup step is required.

#### Scenario: Player completes all steps and character is created
- **WHEN** a player fills in all wizard steps and submits
- **THEN** `createCharacter` is called, the character is saved, and the setup flow advances to the next campaign-setup stage instead of restarting from the beginning

#### Scenario: Player cannot skip ability score assignment
- **WHEN** a player tries to submit the wizard with an unassigned ability score slot
- **THEN** the UI prevents submission and shows a validation message

#### Scenario: Each standard array value can only be used once
- **WHEN** a player assigns 15 to STR
- **THEN** the 15 option is marked as used and cannot be assigned to another score

### Requirement: Web character sheet page at /campaign/[id]/character
The web application SHALL provide a read-only character sheet at `/campaign/[id]/character` displaying: name, race, class, level, proficiency bonus, ability scores with modifiers, HP / max HP, AC, conditions, spell slots (if any), prepared spells (if any), skill proficiencies, and currency (gp/sp/cp). The page SHALL refresh its data at the start of each game session.

#### Scenario: All mechanical stats are displayed
- **WHEN** a player navigates to `/campaign/[id]/character`
- **THEN** all character fields are rendered including computed ability score modifiers

#### Scenario: Non-spellcaster does not show spell section
- **WHEN** a Fighter's character sheet is displayed
- **THEN** no spell slots or prepared spells section is rendered
