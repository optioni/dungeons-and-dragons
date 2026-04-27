# character-inner-monologue Specification

## Purpose
TBD - created by archiving change character-inner-monologue. Update Purpose after archive.
## Requirements
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

### Requirement: Inner monologue streams as INNER_VOICE chunks after DONE
`InnerMonologueService` SHALL stream monologue text as one or more `INNER_VOICE` chunks via `StreamPublisher`, followed by a second `DONE` chunk. The first `DONE` chunk (from the main DM turn) SHALL be emitted before the inner monologue call begins. The frontend SHALL treat `DONE` as idempotent — a second `DONE` on an already-idle session SHALL be ignored without error.

#### Scenario: INNER_VOICE chunks arrive after main DONE
- **WHEN** a DM turn completes and monologue fires
- **THEN** the stream sequence is: `[NARRATIVE_CHUNKs...] → DONE → [INNER_VOICE chunks...] → DONE`

#### Scenario: Second DONE is idempotent on the frontend
- **WHEN** a second DONE chunk arrives after the session is already in idle state
- **THEN** the frontend ignores it without error or state change

### Requirement: Monologue prompt instructs AI to assess difficulty
The inner monologue system prompt SHALL include an instruction directing the AI to assess the narrative difficulty of each insight before calling `roll_skill_check`, and to set the `difficulty` field accordingly. The prompt SHALL describe the three difficulty levels and example scenarios for each.

#### Scenario: Prompt includes difficulty guidance
- **WHEN** `buildSystemPrompt()` is called
- **THEN** the returned string contains instructions about the `difficulty` field and its three values

### Requirement: Monologue prompt grounded in character personality and context
The inner monologue system prompt SHALL include: character name, race, class, personality traits, ideals, bonds, and flaws. When personality fields are empty, the prompt SHALL instruct the AI to draw on the character's race and class background. The user turn SHALL include: current location, NPCs present, and the DM narrative text from the just-completed turn.

#### Scenario: Monologue reflects character personality
- **WHEN** the character has `flaws: ["I distrust authority"]` and the scene involves a guard
- **THEN** the generated monologue reflects that distrust in the character's inner reaction

#### Scenario: Fallback when personality fields are empty
- **WHEN** a character has no personality fields set
- **THEN** the monologue is generated using race and class as the personality anchor without error

### Requirement: Inner monologue persisted to session after generation
After `InnerMonologueService` assembles the final monologue text and publishes it as `INNER_VOICE` SSE chunks, it SHALL write the text to `GameSession.lastInnerVoice` and flush to the database. A flush failure SHALL be caught, logged, and swallowed — it SHALL NOT prevent the SSE stream from completing normally.

#### Scenario: Monologue text saved after streaming
- **WHEN** `InnerMonologueService.runIfApplicable` finishes generating and publishing monologue text
- **THEN** `GameSession.lastInnerVoice` is set to the generated text and persisted

#### Scenario: Flush failure is swallowed
- **WHEN** the database flush after monologue generation throws an error
- **THEN** the error is logged and the method returns without re-throwing; the SSE stream is unaffected

### Requirement: lastInnerVoice cleared when player sends input
`SessionResolver.sendPlayerInput` SHALL set `session.lastInnerVoice = null` and flush before firing `DmOrchestrator.runTurn`. This ensures the stale monologue is removed at the moment the player acts, regardless of whether a new monologue will be generated for the upcoming turn.

#### Scenario: Stale monologue cleared on new input
- **WHEN** a player submits input for a session that has a non-null `lastInnerVoice`
- **THEN** `lastInnerVoice` is set to null in the database before the new DM turn begins

#### Scenario: Clearing with null is a no-op
- **WHEN** a player submits input for a session where `lastInnerVoice` is already null
- **THEN** the flush proceeds without error and the turn fires normally

### Requirement: Frontend restores inner monologue from session on page load
When `play.vue` mounts and fetches the active session, it SHALL read `lastInnerVoice` from the returned `GameSession` and use it to seed `innerVoiceText` if the value is non-null. This restores the monologue display after a page reload without any additional network request.

#### Scenario: Monologue restored after reload
- **WHEN** the page loads and `activeSession.lastInnerVoice` is a non-empty string
- **THEN** `innerVoiceText` is initialised to that string and the monologue panel is visible

#### Scenario: No monologue shown when field is null
- **WHEN** the page loads and `activeSession.lastInnerVoice` is null
- **THEN** `innerVoiceText` remains empty and the monologue panel is not shown

