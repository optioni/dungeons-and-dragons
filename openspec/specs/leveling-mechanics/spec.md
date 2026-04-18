# Leveling Mechanics Spec

## Purpose

Defines the server-side level-up flow — how the LLM triggers a level-up, how the player commits choices, how spell slots are consumed when casting, and how prepared spells are set after a long rest.

## Requirements

### Requirement: Level-up is triggered when the LLM determines the XP threshold is met
The system SHALL expose a `trigger_level_up` tool that accepts `characterId`. The tool SHALL set `GameSession.levelUpPending = true` for the active session of this character's campaign, compute the new level (current + 1), and return a structured payload for the LLM to present to the player: the new level, the class hit die, available ability score improvements (ASI or feat), and any class features unlocked at the new level (derived from `SrdClass.spellSlotProgression` and class feature tables). The tool SHALL NOT yet increment `Character.level` — that happens only when `apply_level_up` is called.

#### Scenario: trigger_level_up sets levelUpPending and returns level-up options
- **WHEN** the LLM calls `trigger_level_up` for a level 3 character
- **THEN** `GameSession.levelUpPending` is set to true and the tool returns `{ newLevel: 4, hitDie: 8, options: { asiOrFeat: true, spellSlots: [...] } }`

#### Scenario: trigger_level_up does not immediately increment character level
- **WHEN** `trigger_level_up` is called
- **THEN** `Character.level` remains unchanged until `apply_level_up` is called

#### Scenario: Only one level-up can be pending at a time
- **WHEN** `trigger_level_up` is called while `GameSession.levelUpPending` is already true
- **THEN** the tool returns `{ success: false, reason: "LEVEL_UP_ALREADY_PENDING" }`

### Requirement: Level-up choices are committed by apply_level_up
The system SHALL expose an `apply_level_up` tool that accepts `characterId` and a `choices` object containing: `abilityScoreImprovements` (map of ability → increment, total increments ≤ 2 for ASI) or `feat` (string, mutually exclusive with ASI), `hitPointsRolled` (integer, result of the hit die roll), and any class-specific selections. The tool SHALL validate the choices against allowed options, increment `Character.level`, apply ability score changes, add `hitPointsRolled + CON modifier` to `Character.maxHp`, update spell slots if the class gains new slots, and clear `GameSession.levelUpPending`.

#### Scenario: ASI choices are applied to character ability scores
- **WHEN** the LLM calls `apply_level_up` with `{ abilityScoreImprovements: { STR: 2 } }`
- **THEN** `Character.abilityScores.STR` increments by 2 and `Character.level` increments by 1

#### Scenario: HP maximum increases on level-up
- **WHEN** `apply_level_up` is called with `hitPointsRolled: 7` for a character with CON modifier +2
- **THEN** `Character.maxHp` increases by 9 (7 + 2)

#### Scenario: levelUpPending is cleared after successful apply
- **WHEN** `apply_level_up` completes successfully
- **THEN** `GameSession.levelUpPending` is set to false

#### Scenario: Invalid choices return structured error
- **WHEN** `apply_level_up` is called with ASI increments totalling more than 2
- **THEN** the tool returns `{ success: false, reason: "INVALID_ASI_CHOICES" }` without modifying character state

### Requirement: Spell slots are decremented when a spell is cast
The system SHALL expose a `use_spell_slot` tool that accepts `characterId` and `level` (1–9). The tool SHALL find the matching entry in `Character.spellSlots` where `spellSlot.level = level`, verify that `used < total`, increment `used` by 1, and return the updated spell slot state. If no slot of the requested level is available, the tool SHALL return `{ success: false, reason: "NO_SPELL_SLOT_AVAILABLE" }`.

#### Scenario: Using a spell slot decrements the available count
- **WHEN** the LLM calls `use_spell_slot` with level 2 and the character has 1 unused level-2 slot
- **THEN** `spellSlots[level=2].used` increments to match `total` and the tool returns the updated slot state

#### Scenario: No available slots returns structured error
- **WHEN** all slots of the requested level are already used (`used === total`)
- **THEN** the tool returns `{ success: false, reason: "NO_SPELL_SLOT_AVAILABLE" }`

#### Scenario: Non-spellcasting class has no spell slots
- **WHEN** `use_spell_slot` is called for a character with an empty `spellSlots` array
- **THEN** the tool returns `{ success: false, reason: "NO_SPELL_SLOT_AVAILABLE" }`

### Requirement: Prepared spells are set after a long rest for prepared-spell classes
The system SHALL expose a `prepare_spells` tool that accepts `characterId` and `spellIds` (array of SrdSpell ids). The tool SHALL replace `Character.preparedSpells` (a `jsonb` array of spell ids) with the provided list. The tool does not validate that the character can actually cast each spell — that responsibility belongs to the LLM acting as DM.

#### Scenario: Prepared spells list is replaced
- **WHEN** the LLM calls `prepare_spells` with a new list of spell ids
- **THEN** `Character.preparedSpells` is replaced with the provided ids

#### Scenario: Preparing an empty list clears all prepared spells
- **WHEN** the LLM calls `prepare_spells` with an empty array
- **THEN** `Character.preparedSpells` is set to an empty array
