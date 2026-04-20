## ADDED Requirements

### Requirement: Drawn monsters are materialised as temporary Npc entities and combat is started
For each drawn `SrdMonster`, the system SHALL construct a temporary `Npc` entity using `EntityManager.create()` with `alive: true`, `hp` and `maxHp` set from `SrdMonster.hitPoints`, `name` from `SrdMonster.name`, and `agenda: null`. These entities SHALL NOT be persisted to the database. The system SHALL then call the `start_combat` handler directly, passing the player character and all temporary NPCs as participants. The `travel_to` tool result SHALL include an `encounter` object with the monster names and a generated encounter description (e.g. "A pair of goblins ambushes you on the road").

#### Scenario: Temporary NPCs are created with correct stats from SrdMonster
- **WHEN** a `SrdMonster` with `hitPoints: 7` is drawn for an encounter
- **THEN** the temporary `Npc` entity has `hp: 7` and `maxHp: 7`

#### Scenario: Temporary NPCs are not persisted to the database
- **WHEN** the encounter combat is started with temporary NPCs
- **THEN** no new `Npc` rows appear in the database after the tool call completes

#### Scenario: start_combat is called with the player and all temporary NPCs
- **WHEN** 2 monsters are drawn for an encounter
- **THEN** `start_combat` receives 3 participants: the player character plus the 2 temporary NPCs, and returns a valid `CombatSession`

#### Scenario: travel_to result includes encounter description
- **WHEN** an encounter is triggered and combat is started
- **THEN** the tool result contains `encounter.description` with a narrative string naming the monsters
