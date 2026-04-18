# Dice and Checks Spec

## Purpose

Defines server-side dice rolling and ability/skill check mechanics — how dice expressions are evaluated, how skill checks apply proficiency and ability modifiers, and how raw ability checks are resolved.

## Requirements

### Requirement: Dice expressions are evaluated server-side
The system SHALL expose a `roll_dice` tool that accepts a standard dice notation expression (e.g. `"2d6+3"`, `"1d20"`, `"4d6kh3"`) and returns the total, individual die values, and the original expression. The tool SHALL support addition and subtraction modifiers and SHALL support keep-highest (`kh`) and keep-lowest (`kl`) drop notation for advantage/disadvantage rolls. All randomness SHALL be server-generated — the client never provides a seed.

#### Scenario: Simple expression returns total and rolls
- **WHEN** the LLM calls `roll_dice("2d6+3")`
- **THEN** the tool returns `{ total, rolls: [number, number], expression: "2d6+3" }` where `total` equals the sum of the two rolls plus 3

#### Scenario: d20 advantage uses keep-highest
- **WHEN** the LLM calls `roll_dice("2d20kh1")`
- **THEN** the tool rolls two d20s, keeps the higher value, and returns both rolls alongside the kept total

#### Scenario: Invalid expression returns structured error
- **WHEN** the LLM calls `roll_dice` with a malformed expression such as `"2x6"`
- **THEN** the tool returns `{ success: false, reason: "INVALID_EXPRESSION" }` and does not throw an unhandled exception

### Requirement: Skill checks apply character proficiency and ability modifier
The system SHALL expose a `check_skill` tool that accepts `characterId`, a `SkillName` (e.g. `"PERCEPTION"`, `"STEALTH"`), and a `dc` integer. The tool SHALL resolve the character's relevant ability modifier and, if the character is proficient in that skill, add the proficiency bonus. It SHALL roll 1d20, apply the modifiers, compare to the DC, and return pass or fail with the full breakdown.

#### Scenario: Proficient skill check applies bonus
- **WHEN** the LLM calls `check_skill` for a character proficient in STEALTH with a DEX modifier of +3 and proficiency bonus +2 against DC 15
- **THEN** the tool rolls 1d20, adds 5, and returns `{ success: <roll+5 >= 15>, roll, modifier: 5, dc: 15 }`

#### Scenario: Non-proficient skill check omits proficiency bonus
- **WHEN** the LLM calls `check_skill` for a character not proficient in PERSUASION with a CHA modifier of +1 against DC 12
- **THEN** the tool rolls 1d20, adds only 1, and returns the result without including the proficiency bonus

#### Scenario: Expert skill check doubles the proficiency bonus
- **WHEN** the LLM calls `check_skill` for a character with expertise in a skill
- **THEN** the tool applies double the proficiency bonus to the total

#### Scenario: Unknown character returns structured error
- **WHEN** the LLM calls `check_skill` with a `characterId` that does not exist
- **THEN** the tool returns `{ success: false, reason: "CHARACTER_NOT_FOUND" }`

### Requirement: Raw ability checks apply only the ability modifier
The system SHALL expose a `check_ability` tool that accepts `characterId`, an `AbilityName` (STR, DEX, CON, INT, WIS, CHA), and a `dc` integer. The tool SHALL roll 1d20, add the character's modifier for that ability (no proficiency bonus), and return pass or fail with the breakdown. This is used for Constitution saves, Strength contests, and similar raw-ability situations.

#### Scenario: Ability check returns roll plus modifier only
- **WHEN** the LLM calls `check_ability` with a character whose STR modifier is +2 against DC 13
- **THEN** the tool rolls 1d20, adds 2, and returns `{ success: <roll+2 >= 13>, roll, modifier: 2, dc: 13 }`

#### Scenario: Ability check does not include proficiency
- **WHEN** a character has both proficiency in Athletics and high STR
- **THEN** `check_ability` with STR returns the ability modifier only and does not include the proficiency bonus
