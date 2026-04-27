## MODIFIED Requirements

### Requirement: AI selects skills via roll_skill_check tool calls
The inner monologue Haiku call SHALL expose a single tool: `roll_skill_check(skill: SkillName, difficulty?: "easy" | "medium" | "hard")`. The AI SHALL call this tool for whichever skills it deems narratively relevant, up to a maximum of 2 calls per turn. The AI SHALL set `difficulty` based on how narratively hard the check should be — `easy` for routine or low-stakes observations, `medium` for moderately unclear situations, `hard` for deceptive, obscure, or high-stakes assessments. After 2 calls the tool-loop SHALL force `end_turn`. Eligible skills: `perception`, `insight`, `investigation`, `history`, `arcana`, `survival`. All other skill names SHALL be rejected with a structured error result.

#### Scenario: AI rolls a relevant skill with difficulty
- **WHEN** the inner monologue AI calls `roll_skill_check("insight", "hard")`
- **THEN** the server rolls `d20 + WIS modifier (+ proficiency bonus if applicable)` and returns `{ skill, rolled, modifier, total, dc: <number in 16–18>, success: boolean }`

#### Scenario: AI rolls without specifying difficulty
- **WHEN** the inner monologue AI calls `roll_skill_check("perception")` with no difficulty field
- **THEN** the server defaults to medium difficulty (DC 12–14) and returns the result accordingly

#### Scenario: Tool call cap enforced
- **WHEN** the AI has already made 2 `roll_skill_check` calls in a single monologue turn
- **THEN** the tool-loop ends and the AI generates prose from the results already in hand

#### Scenario: Ineligible skill rejected
- **WHEN** the AI calls `roll_skill_check("athletics")`
- **THEN** the tool returns `{ error: "skill not available for inner monologue" }` and the AI continues without a roll result for that skill

### Requirement: Server owns the dice; AI owns the prose
The server SHALL compute `d20 + ability modifier + proficiency bonus (if applicable)` using `DiceService` and compare against a DC selected authoritatively by the server within the range for the requested difficulty. DC ranges:
- `easy` → 8–10 (random within range each call)
- `medium` → 12–14 (random within range each call; default when `difficulty` omitted)
- `hard` → 16–18 (random within range each call)

The character's proficiency bonus SHALL be added to `total` (not `modifier`) when `character.skillProficiencies[skill]` is `"proficient"`, and `2 × proficiencyBonus` when it is `"expert"`. The tool return value SHALL include the `dc` actually used. The AI SHALL receive the structured result and write monologue prose consistent with the outcome. A failed Insight check SHALL result in a confident wrong read of the situation. A failed Perception check SHALL result in the character noticing nothing unusual.

#### Scenario: Proficient character gains bonus on roll
- **WHEN** `roll_skill_check("perception", "medium")` is called for a character with `skillProficiencies.Perception === "proficient"` and proficiency bonus 2
- **THEN** the result `total` equals `rolled + WIS modifier + 2` and `dc` is a value in 12–14

#### Scenario: Expert character gains double proficiency
- **WHEN** `roll_skill_check("insight", "easy")` is called for a character with `skillProficiencies.Insight === "expert"` and proficiency bonus 3
- **THEN** the result `total` equals `rolled + WIS modifier + 6` and `dc` is a value in 8–10

#### Scenario: Non-proficient character rolls without bonus
- **WHEN** `roll_skill_check("arcana", "hard")` is called for a character with `skillProficiencies.Arcana === "none"`
- **THEN** the result `total` equals `rolled + INT modifier` (no proficiency added) and `dc` is a value in 16–18

#### Scenario: DC varies within category across calls
- **WHEN** `roll_skill_check` is called multiple times with `difficulty: "medium"`
- **THEN** the `dc` returned MAY differ between calls, always within 12–14

#### Scenario: Failed Insight produces wrong read
- **WHEN** `roll_skill_check("insight", ...)` returns `{ success: false }`
- **THEN** the generated monologue reflects the character confidently misreading a person or situation

#### Scenario: Successful Perception reveals a detail
- **WHEN** `roll_skill_check("perception", ...)` returns `{ success: true }`
- **THEN** the generated monologue has the character noticing something real about the environment or scene

### Requirement: Monologue prompt instructs AI to assess difficulty
The inner monologue system prompt SHALL include an instruction directing the AI to assess the narrative difficulty of each insight before calling `roll_skill_check`, and to set the `difficulty` field accordingly. The prompt SHALL describe the three difficulty levels and example scenarios for each.

#### Scenario: Prompt includes difficulty guidance
- **WHEN** `buildSystemPrompt()` is called
- **THEN** the returned string contains instructions about the `difficulty` field and its three values
