# Combat Mechanics Spec

## Purpose

Defines the server-side combat model — how combat sessions are initiated, how initiative and turn order are managed, how damage and healing are applied, how conditions and death saves are tracked, and how combat ends.

## Requirements

### Requirement: Combat is initiated with a persisted CombatSession
The system SHALL expose a `start_combat` tool that accepts a `participants` array of `{ type: 'CHARACTER' | 'NPC', id: string, initiativeRoll?: number }` entries. The tool SHALL create a `CombatSession` entity linked OneToOne to the active `GameSession`. The `CombatSession` SHALL store each combatant's initiative roll (auto-rolled for any participant not provided), sorted initiative order, current HP (read from `Character.hp` for the player and from `Npc.hp` or a provided value for NPCs), action economy flags (`usedAction`, `usedBonusAction`, `usedReaction`, `movementUsed`), and active conditions. Only one `CombatSession` SHALL exist per `GameSession` at a time.

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

### Requirement: Initiative advances turn-by-turn
The system SHALL expose an `advance_initiative` tool that accepts `sessionId` and moves the `CombatSession.currentTurnIndex` to the next combatant in initiative order. It SHALL reset the current combatant's action economy flags (`usedAction = false`, `usedBonusAction = false`, `usedReaction = false`, `movementUsed = 0`) before advancing. When the last combatant's turn ends, the index wraps back to 0 to begin a new round.

#### Scenario: Turn advances to the next combatant
- **WHEN** the LLM calls `advance_initiative` for an active combat
- **THEN** the current turn index increments and the previously active combatant's action economy flags are reset

#### Scenario: Last combatant wraps to first on next round
- **WHEN** the LLM calls `advance_initiative` and the current combatant is last in initiative order
- **THEN** the index resets to 0 and the round counter increments

#### Scenario: Advance on no active combat returns structured error
- **WHEN** the LLM calls `advance_initiative` for a session with no active `CombatSession`
- **THEN** the tool returns `{ success: false, reason: "NO_ACTIVE_COMBAT" }`

### Requirement: Damage is applied to characters and NPC combatants
The system SHALL expose an `apply_damage` tool that accepts `sessionId`, a `targetId` (character or NPC id), `amount` (integer ≥ 0), and `damageType` (string, e.g. `"SLASHING"`, `"FIRE"`). For a character target, the tool SHALL decrement `Character.hp` to a minimum of 0. For an NPC target, the tool SHALL decrement the HP value in `CombatSession.combatants` JSON. After applying damage, if a character target's HP reaches 0, the tool SHALL flag the character as downed (return `{ downed: true }` in the result). If a single hit exceeds the character's `maxHp` in remaining HP, it SHALL return `{ massiveDamage: true }` so the LLM can invoke `instant_death` instead.

#### Scenario: Damage reduces character HP
- **WHEN** the LLM calls `apply_damage` targeting the player character with 8 damage and the character has 15 HP
- **THEN** `Character.hp` is set to 7 and the tool returns `{ newHp: 7, downed: false }`

#### Scenario: Character HP cannot go below zero
- **WHEN** `apply_damage` would reduce HP below 0
- **THEN** `Character.hp` is set to 0 and the tool returns `{ newHp: 0, downed: true }`

#### Scenario: Massive damage signals instant death eligibility
- **WHEN** damage in a single hit is ≥ the character's `maxHp`
- **THEN** the tool returns `{ newHp: 0, downed: true, massiveDamage: true }` so the LLM may call `instant_death`

#### Scenario: NPC damage updates CombatSession combatant entry
- **WHEN** the LLM calls `apply_damage` targeting an NPC combatant
- **THEN** the HP value in `CombatSession.combatants` JSON for that NPC is decremented accordingly

### Requirement: Healing restores HP up to the character's maximum
The system SHALL expose a `heal` tool that accepts `characterId` and `amount`. It SHALL increment `Character.hp` by `amount`, capped at `Character.maxHp`. Healing a character at 0 HP SHALL also reset `deathSaveSuccesses` and `deathSaveFailures` to 0.

#### Scenario: Heal increases HP up to max
- **WHEN** the LLM calls `heal` with `amount: 5` on a character with 8 HP and 20 max HP
- **THEN** `Character.hp` becomes 13

#### Scenario: Heal does not exceed maxHp
- **WHEN** the LLM calls `heal` with `amount: 100` on a character with 18 HP and 20 max HP
- **THEN** `Character.hp` is set to 20, not 118

#### Scenario: Healing a downed character resets death save counters
- **WHEN** the LLM calls `heal` on a character whose HP is 0
- **THEN** `deathSaveSuccesses` and `deathSaveFailures` are reset to 0 in addition to restoring HP

### Requirement: Conditions are applied to and removed from characters
The system SHALL expose `apply_condition` and `remove_condition` tools that accept `characterId` and `condition` (a string condition name, e.g. `"POISONED"`, `"PRONE"`). `apply_condition` SHALL append the condition to `Character.conditions` if not already present. `remove_condition` SHALL remove it if present. Neither operation SHALL error if the condition is already present or already absent respectively.

#### Scenario: Condition is added to character
- **WHEN** the LLM calls `apply_condition("POISONED")` on a character without that condition
- **THEN** `"POISONED"` is appended to `Character.conditions`

#### Scenario: Duplicate condition is idempotent
- **WHEN** the LLM calls `apply_condition("PRONE")` on a character already marked as PRONE
- **THEN** the condition list is unchanged and the tool returns success

#### Scenario: Removing absent condition is idempotent
- **WHEN** the LLM calls `remove_condition("BLINDED")` on a character who is not blinded
- **THEN** the tool returns success without modifying the character

### Requirement: Death saves track progress toward stabilisation or death
The system SHALL expose a `roll_death_save` tool that accepts `characterId`. It SHALL roll 1d20: a natural 20 restores the character to 1 HP immediately; a 10 or higher increments `deathSaveSuccesses`; below 10 increments `deathSaveFailures`; a natural 1 increments `deathSaveFailures` by 2. Three successes result in stabilisation; three failures result in death (`Character.alive = false`).

#### Scenario: Three successes stabilise the character
- **WHEN** `roll_death_save` is called and the character accumulates 3 successes
- **THEN** the tool sets `Character.hp = 1`, resets both counters, and returns `{ outcome: "STABILISED" }`

#### Scenario: Three failures kill the character
- **WHEN** `roll_death_save` is called and the character accumulates 3 failures
- **THEN** the tool sets `Character.alive = false` and returns `{ outcome: "DEAD" }`

#### Scenario: Natural 20 immediately revives the character
- **WHEN** the death save roll is a natural 20
- **THEN** `Character.hp` is set to 1, both counters reset, and the tool returns `{ outcome: "STABILISED", natural20: true }`

#### Scenario: Natural 1 counts as two failures
- **WHEN** the death save roll is a natural 1
- **THEN** `deathSaveFailures` increments by 2

### Requirement: Instant death and manual stabilisation bypass the death save loop
The system SHALL expose `instant_death` and `stabilise` tools. `instant_death` accepts `characterId` and sets `Character.alive = false` and `Character.hp = 0` without requiring accumulated failures — used for massive damage or narrative death. `stabilise` accepts `characterId`, sets `Character.hp = 1`, and resets both death save counters — used when an NPC provides aid mid-combat.

#### Scenario: Instant death bypasses death saves
- **WHEN** the LLM calls `instant_death` on a downed character
- **THEN** `Character.alive` is set to `false` without checking death save counters

#### Scenario: Stabilise revives a downed character
- **WHEN** the LLM calls `stabilise` on a character at 0 HP
- **THEN** `Character.hp` is set to 1 and both death save counters reset to 0

### Requirement: Combat ends and CombatSession is deleted
The system SHALL expose an `end_combat` tool that accepts `sessionId`. It SHALL persist final HP to `Npc.hp` for any named NPC combatant (one whose `Npc.hp` was not null before combat). It SHALL clear all conditions that are combat-only (such as PRONE) from the player character. It SHALL delete the `CombatSession` row.

#### Scenario: Ending combat deletes the CombatSession
- **WHEN** the LLM calls `end_combat` for the active session
- **THEN** the `CombatSession` row is deleted and the tool returns success

#### Scenario: Named NPC final HP is persisted
- **WHEN** `end_combat` is called and a named NPC combatant (one with a pre-existing `Npc.hp`) participated
- **THEN** that NPC's `hp` field is updated to match the final HP from the combat session
