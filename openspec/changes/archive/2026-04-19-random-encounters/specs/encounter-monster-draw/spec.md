## ADDED Requirements

### Requirement: Encounter monster draw selects 1–3 SrdMonsters by CR bracket
When an encounter is triggered, the system SHALL query `SrdMonster` filtered to challenge ratings within the bracket `[floor(characterLevel / 2) - 1, floor(characterLevel / 2) + 1]`, clamped to the valid CR range [0, 30]. The query SHALL return 1–3 monsters selected at random (using `ORDER BY RANDOM()` in the database). If the CR-filtered query returns 0 rows, the encounter SHALL be silently cancelled and the tool result SHALL note no monsters were found.

#### Scenario: Draw returns monsters within the character's CR bracket
- **WHEN** an encounter is triggered for a character of level 4 (CR bracket 1–3)
- **THEN** all drawn monsters have a challenge rating between 1 and 3 inclusive

#### Scenario: Draw at level 1 clamps CR bracket to valid range
- **WHEN** an encounter is triggered for a level 1 character (bracket would be -1 to 1)
- **THEN** the query uses CR bracket [0, 1]

#### Scenario: Empty CR bracket cancels the encounter
- **WHEN** no `SrdMonster` rows exist within the calculated CR bracket
- **THEN** no combat is started and the tool result contains `{ encounter: { triggered: true, monsters: [], reason: "NO_MONSTERS_IN_BRACKET" } }`

#### Scenario: Draw count is uniformly random between 1 and 3
- **WHEN** an encounter is triggered and monsters exist in the bracket
- **THEN** between 1 and 3 monster entries are drawn and included in the encounter
