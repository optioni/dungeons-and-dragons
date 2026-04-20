## MODIFIED Requirements

### Requirement: Combat is initiated with a persisted CombatSession
The system SHALL expose a `start_combat` tool that accepts a `participants` array of `{ type: 'CHARACTER' | 'NPC', id: string, initiativeRoll?: number }` entries. The tool SHALL create a `CombatSession` entity linked OneToOne to the active `GameSession`. The `CombatSession` SHALL store each combatant's initiative roll (auto-rolled for any participant not provided), sorted initiative order, current HP (read from `Character.hp` for the player and from `Npc.hp` or a provided value for NPCs), action economy flags (`usedAction`, `usedBonusAction`, `usedReaction`, `movementUsed`), and active conditions. Only one `CombatSession` SHALL exist per `GameSession` at a time. NPC participants MAY be temporary in-memory entities (constructed but not persisted) — the handler SHALL accept any `Npc`-shaped object without requiring a database-backed row.

#### Scenario: Starting combat creates a CombatSession with initiative order
- **WHEN** the LLM calls `start_combat` with a list of participants
- **THEN** the system creates a `CombatSession` row, rolls initiative for any participant without a provided roll, sorts combatants by initiative descending, and returns the ordered combatant list

#### Scenario: Starting combat while one is already active returns structured error
- **WHEN** a `CombatSession` already exists for the active `GameSession` and `start_combat` is called again
- **THEN** the tool returns `{ success: false, reason: "COMBAT_ALREADY_ACTIVE" }` without creating a second record

#### Scenario: NPC HP is initialised from Npc entity or provided value
- **WHEN** `start_combat` includes an NPC participant whose `Npc.hp` is not null
- **THEN** the combatant entry uses the stored `Npc.hp` value as `currentHp`

#### Scenario: Temporary NPC participants are accepted without database persistence
- **WHEN** `start_combat` is called with in-memory NPC entities (not persisted to the database) as participants
- **THEN** the `CombatSession` is created successfully using the in-memory entity data, and no attempt is made to look up the NPCs by id in the database
