## Why

The inner monologue skill check system uses a hardcoded DC 12 for every roll, regardless of narrative context — noticing a hidden dagger and recognising the weather both hit the same difficulty. This makes the character's inner voice either systematically unreliable or systematically omniscient depending on the character's ability scores, breaking immersion. Additionally, the roll ignores proficiency, so a rogue with Expertise in Perception and a wizard with the same WIS score perform identically.

## What Changes

- `roll_skill_check` tool gains an optional `difficulty` field (`"easy"` | `"medium"` | `"hard"`) that the AI sets based on how narratively hard the check should be
- Server maps `difficulty` to a DC range and selects the exact DC authoritatively within that range:
  - `easy` → DC 8–10
  - `medium` → DC 12–14 (default when omitted)
  - `hard` → DC 16–18
- `rollSkillCheck()` applies the character's proficiency bonus when the character is proficient in the rolled skill
- Tool return value expands to include the `dc` actually used (already in the response shape; now contextually set)
- System prompt updated to instruct the AI to assess difficulty based on narrative context before calling the tool

## Capabilities

### New Capabilities

_(none — this change only modifies an existing capability)_

### Modified Capabilities

- `character-inner-monologue`: `roll_skill_check` tool schema gains `difficulty`; DC calculation becomes context-sensitive; proficiency bonus applied when character is proficient in the skill

## Impact

- `apps/api/src/llm/inner-monologue.service.ts` — `rollSkillCheck()` method, `buildSystemPrompt()`, tool schema definition
- `apps/api/src/character/entities/character.entity.ts` — proficiency data must be accessible (likely already present via skill proficiencies)
- No database changes, no GraphQL schema changes, no frontend changes
