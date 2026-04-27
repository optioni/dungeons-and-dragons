## Context

`InnerMonologueService.rollSkillCheck()` currently hardcodes `dc = 12` for every passive check and ignores the character's proficiency in the rolled skill. The Haiku LLM calls the `roll_skill_check` tool with only a `skill` argument; the server decides the outcome. Because the DC never varies, a rogue with Expertise in Perception and a wizard with identical WIS behave identically — undermining the character sheet and breaking narrative immersion.

The character entity already exposes everything needed: `character.skillProficiencies` (Record<SkillName, 'none' | 'proficient' | 'expert'>) and `character.proficiencyBonus` (a derived getter: `Math.floor((level - 1) / 4) + 2`). No new data is required.

## Goals / Non-Goals

**Goals:**
- Let the LLM signal narrative difficulty via an optional `difficulty` field on `roll_skill_check`
- Map `difficulty` to a DC range server-side, selecting the exact DC authoritatively (LLM never chooses a number)
- Apply proficiency bonus (×1 for proficient, ×2 for expert) to the character's total when the skill is in scope
- Update `buildSystemPrompt()` to instruct the LLM to assess difficulty before calling the tool
- Keep the response shape identical — callers already receive `dc` in the result

**Non-Goals:**
- Changing which skills are eligible for inner monologue
- Exposing DC configuration to the frontend or GraphQL schema
- Modifying the main DM session skill check flow (`GameEngineModule`)
- Supporting arbitrary numeric DCs from the LLM

## Decisions

### 1. LLM provides difficulty category; server selects DC

**Decision:** Add an optional `difficulty: "easy" | "medium" | "hard"` field to the `roll_skill_check` tool schema. The server maps each category to a DC range and picks within it:
- `easy` → 8–10
- `medium` → 12–14 (default when field is omitted)
- `hard` → 16–18

**Why over letting the LLM pick a number:** The LLM picking a raw DC introduces drift — it may rationalise extreme values. A category + server-authoritative selection keeps the LLM in the narrative domain and the server in the mechanical domain, consistent with the rest of the game engine (where the server always resolves mechanics).

**Why over a single fixed DC per category:** Picking randomly within the range (e.g., `easy` can be 8, 9, or 10) adds unpredictability that mirrors the DM experience and prevents the player from gaming a known lookup table.

### 2. Proficiency applied server-side only

**Decision:** `rollSkillCheck()` reads `character.skillProficiencies[skill]` and adds `proficiencyBonus` (×1) or `2 × proficiencyBonus` (×2 for 'expert'). The LLM is not told about proficiency in the tool schema — it is irrelevant to difficulty assessment.

**Why:** Proficiency is a mechanical fact, not a narrative judgment. Keeping it out of the tool interface maintains separation between the narrative (LLM) and mechanical (server) layers.

### 3. Skill name normalisation for proficiency lookup

**Decision:** `SKILL_TO_ABILITY` already uses lowercase keys (`perception`, `insight`, …). Proficiency lookup must capitalise the first letter to match `SkillName` (e.g., `Perception`). A simple title-case helper inside `rollSkillCheck()` is sufficient — no shared utility needed given only 6 eligible skills.

**Why not a shared helper:** YAGNI — this mapping is private to the inner monologue flow and involves only 6 known values.

### 4. Default when `difficulty` is omitted

**Decision:** Omitting `difficulty` maps to the `medium` range (DC 12–14). This preserves existing behaviour for any call that doesn't set the field, avoiding surprises if the LLM forgets to include it.

## Risks / Trade-offs

- **LLM may not use `difficulty` consistently** → Mitigation: system prompt explicitly instructs the LLM to assess difficulty before calling the tool; omitting it falls back to medium, which is acceptable.
- **DC range randomness could occasionally feel unfair** (e.g., always rolling the high end of `easy`)  → Mitigation: the range is narrow (3 values), and long-run average is centred on the category midpoint.
- **`proficiencyBonus` getter silently returns 2 for level 1** (correct per 5e) — no risk, but worth noting the getter is already correct.

## Migration Plan

1. Update `roll_skill_check` tool schema in `buildSystemPrompt()` to include `difficulty` as an optional enum field with description
2. Update system prompt text to instruct the LLM to set `difficulty` based on narrative context
3. Update `rollSkillCheck()` signature to accept `difficulty?: 'easy' | 'medium' | 'hard'`
4. Add DC range map and server-side random selection within range
5. Load `character.skillProficiencies` in `runIfApplicable()` (add to `populate` array if not already loaded)
6. Apply proficiency in `rollSkillCheck()`: read `character.skillProficiencies`, add bonus accordingly
7. Update unit tests in `context-loader.service.spec.ts` (and any inner-monologue tests) to cover new DC logic and proficiency paths

No database migrations, no GraphQL schema changes, no frontend changes. Rollback is a revert of the service file.

## Open Questions

_(none — scope is fully defined by the proposal)_
