## ADDED Requirements

### Requirement: Inner monologue fires after each eligible DM turn
After `DmOrchestrator.runTurn` completes its tool loop, `InnerMonologueService.runIfApplicable` SHALL be called with the session ID, current scene type, and the accumulated DM narrative text. It SHALL fire only when `sceneType` is one of: `EXPLORATION`, `SOCIAL`, `SETTLEMENT`, `DUNGEON`. It SHALL return immediately without a Haiku call when `sceneType` is `COMBAT` or `REST`.

#### Scenario: Monologue fires in an eligible scene
- **WHEN** a DM turn completes in SOCIAL scene type
- **THEN** `InnerMonologueService.runIfApplicable` initiates a Haiku tool-loop

#### Scenario: Monologue skipped in COMBAT
- **WHEN** a DM turn completes in COMBAT scene type
- **THEN** `InnerMonologueService.runIfApplicable` returns without any LLM call or stream emission

#### Scenario: Monologue skipped in REST
- **WHEN** a DM turn completes in REST scene type
- **THEN** `InnerMonologueService.runIfApplicable` returns without any LLM call or stream emission

### Requirement: AI selects skills via roll_skill_check tool calls
The inner monologue Haiku call SHALL expose a single tool: `roll_skill_check(skill: SkillName)`. The AI SHALL call this tool for whichever skills it deems narratively relevant, up to a maximum of 2 calls per turn. After 2 calls the tool-loop SHALL force `end_turn`. Eligible skills: `perception`, `insight`, `investigation`, `history`, `arcana`, `survival`. All other skill names SHALL be rejected with a structured error result.

#### Scenario: AI rolls a relevant skill
- **WHEN** the inner monologue AI calls `roll_skill_check("insight")`
- **THEN** the server rolls `d20 + WIS modifier` for the character and returns `{ skill, rolled, modifier, total, dc: 12, success: boolean }`

#### Scenario: Tool call cap enforced
- **WHEN** the AI has already made 2 `roll_skill_check` calls in a single monologue turn
- **THEN** the tool-loop ends and the AI generates prose from the results already in hand

#### Scenario: Ineligible skill rejected
- **WHEN** the AI calls `roll_skill_check("athletics")`
- **THEN** the tool returns `{ error: "skill not available for inner monologue" }` and the AI continues without a roll result for that skill

### Requirement: Server owns the dice; AI owns the prose
The server SHALL compute `d20 + modifier` using `DiceService` and compare against DC 12. The AI SHALL receive the structured result and write monologue prose consistent with the outcome. A failed Insight check SHALL result in a confident wrong read of the situation. A failed Perception check SHALL result in the character noticing nothing unusual.

#### Scenario: Failed Insight produces wrong read
- **WHEN** `roll_skill_check("insight")` returns `{ success: false }`
- **THEN** the generated monologue reflects the character confidently misreading a person or situation

#### Scenario: Successful Perception reveals a detail
- **WHEN** `roll_skill_check("perception")` returns `{ success: true }`
- **THEN** the generated monologue has the character noticing something real about the environment or scene

### Requirement: Inner monologue streams as INNER_VOICE chunks after DONE
`InnerMonologueService` SHALL stream monologue text as one or more `INNER_VOICE` chunks via `StreamPublisher`, followed by a second `DONE` chunk. The first `DONE` chunk (from the main DM turn) SHALL be emitted before the inner monologue call begins. The frontend SHALL treat `DONE` as idempotent — a second `DONE` on an already-idle session SHALL be ignored without error.

#### Scenario: INNER_VOICE chunks arrive after main DONE
- **WHEN** a DM turn completes and monologue fires
- **THEN** the stream sequence is: `[NARRATIVE_CHUNKs...] → DONE → [INNER_VOICE chunks...] → DONE`

#### Scenario: Second DONE is idempotent on the frontend
- **WHEN** a second DONE chunk arrives after the session is already in idle state
- **THEN** the frontend ignores it without error or state change

### Requirement: Monologue prompt grounded in character personality and context
The inner monologue system prompt SHALL include: character name, race, class, personality traits, ideals, bonds, and flaws. When personality fields are empty, the prompt SHALL instruct the AI to draw on the character's race and class background. The user turn SHALL include: current location, NPCs present, and the DM narrative text from the just-completed turn.

#### Scenario: Monologue reflects character personality
- **WHEN** the character has `flaws: ["I distrust authority"]` and the scene involves a guard
- **THEN** the generated monologue reflects that distrust in the character's inner reaction

#### Scenario: Fallback when personality fields are empty
- **WHEN** a character has no personality fields set
- **THEN** the monologue is generated using race and class as the personality anchor without error
