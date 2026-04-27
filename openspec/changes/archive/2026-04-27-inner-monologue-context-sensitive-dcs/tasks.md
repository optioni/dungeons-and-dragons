## 1. Tool Schema

- [x] 1.1 Add `difficulty?: "easy" | "medium" | "hard"` parameter to the `roll_skill_check` tool definition in `buildSystemPrompt()` with a description explaining the three levels
- [x] 1.2 Update the system prompt text to instruct the AI to assess narrative difficulty before each `roll_skill_check` call, with brief examples of easy / medium / hard scenarios

## 2. DC Resolution

- [x] 2.1 Define a `DC_RANGES` constant mapping each difficulty to a `[min, max]` tuple: `easy → [8, 10]`, `medium → [12, 14]`, `hard → [16, 18]`
- [x] 2.2 Add a `selectDc(difficulty?: string): number` private helper that picks a random integer within the range for the given difficulty, defaulting to `medium` when `difficulty` is omitted or unrecognised

## 3. Proficiency Bonus

- [x] 3.1 Update `rollSkillCheck()` signature to accept `difficulty?: string` and the character's `skillProficiencies` and `proficiencyBonus`
- [x] 3.2 Add a title-case helper (or inline lookup) to map the lowercase `EligibleSkill` key to its `SkillName` counterpart (e.g., `perception` → `Perception`) for the proficiency lookup
- [x] 3.3 Compute proficiency contribution: `0` for `"none"`, `proficiencyBonus` for `"proficient"`, `2 × proficiencyBonus` for `"expert"`
- [x] 3.4 Add proficiency contribution to `total` (not `modifier`); keep `modifier` as the raw ability modifier so the return value remains informative

## 4. Wire Up in runIfApplicable

- [x] 4.1 Ensure `character.skillProficiencies` is loaded when `findOne` fetches the character (add to `populate` array if absent or confirm it is a plain JSON column that loads automatically)
- [x] 4.2 Pass `difficulty` from the tool call input, plus `character.skillProficiencies` and `character.proficiencyBonus`, into `rollSkillCheck()`
- [x] 4.3 Include the `dc` actually used in the tool result returned to the LLM (already in the response shape — confirm the value is now contextual, not hardcoded)

## 5. Tests

- [x] 5.1 Write unit tests for `selectDc()`: assert each difficulty maps to its expected range, omitted difficulty defaults to medium
- [x] 5.2 Write unit tests for proficiency application in `rollSkillCheck()`: none / proficient / expert each produce the correct `total`
- [x] 5.3 Write a unit test asserting `dc` in the return value is within the expected range for each difficulty level
- [x] 5.4 Confirm existing inner monologue tests still pass; update any that assert `dc === 12` to assert `dc >= 12 && dc <= 14`
