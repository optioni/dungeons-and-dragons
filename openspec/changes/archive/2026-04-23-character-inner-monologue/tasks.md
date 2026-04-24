## 1. Character Entity — Personality Fields

- [x] 1.1 Add `personalityTraits`, `ideals`, `bonds`, `flaws` as nullable `string[]` JSONB columns to `Character` entity with empty-array defaults
- [x] 1.2 Expose all four fields as `[String!]!` on the `Character` GraphQL `ObjectType`
- [x] 1.3 Create MikroORM migration for the four new columns

## 2. Context Loader — Expanded Character Sheet

- [x] 2.1 Add ability scores (all six with computed modifiers), skill proficiencies, race name, and class name to `loadWorldBlock` character sheet section
- [x] 2.2 Add personality fields to `loadWorldBlock` character sheet section; omit section when all arrays are empty
- [x] 2.3 Update `context-loader.service.spec.ts` to assert the new fields appear in the world block output

## 3. Character Creation Flow — Personality Population

- [x] 3.1 Extend the real character-creation flow to populate `personalityTraits`, `ideals`, `bonds`, and `flaws` (1–2 entries each when generation is available)
- [x] 3.2 Persist personality fields into the `Character` entity during character creation; fall back to empty arrays if those fields are absent

## 4. Inner Monologue Service

- [x] 4.1 Create `InnerMonologueService` in `LLMModule` with `runIfApplicable(sessionId, sceneType, narrativeText)` method
- [x] 4.2 Implement scene type guard — return early for `COMBAT` and `REST`
- [x] 4.3 Implement `roll_skill_check` tool definition restricted to: `perception`, `insight`, `investigation`, `history`, `arcana`, `survival`
- [x] 4.4 Implement the Haiku tool-loop: call model, handle `roll_skill_check` tool calls via `DiceService` (d20 + stat modifier vs DC 12), enforce 2-call cap
- [x] 4.5 Return structured error `{ error: "skill not available for inner monologue" }` for any ineligible skill name
- [x] 4.6 Assemble the inner monologue system prompt: character identity (name, race, class), personality fields with fallback, and skill-choice instruction
- [x] 4.7 Assemble the inner monologue user turn: current location, NPCs present at location, and the DM narrative text
- [x] 4.8 Stream generated text as `INNER_VOICE` chunks via `StreamPublisher`; emit a second `DONE` chunk after the loop ends
- [x] 4.9 Wrap the entire method in try/catch — log errors but do not re-throw (main turn DONE has already been emitted)
- [x] 4.10 Register `InnerMonologueService` in `LlmModule` and export it

## 5. Stream Chunk Type

- [x] 5.1 Add `INNER_VOICE = 'INNER_VOICE'` to `DmStreamChunkType` enum

## 6. DM Orchestrator — Wire Inner Monologue

- [x] 6.1 Inject `InnerMonologueService` into `DmOrchestrator`
- [x] 6.2 In `runTurn`: emit main `DONE` chunk first, then call `innerMonologueService.runIfApplicable`, in the `finally` block

## 7. Unit Tests

- [x] 7.1 Test `InnerMonologueService`: verify early return for COMBAT and REST scene types
- [x] 7.2 Test `InnerMonologueService`: verify `roll_skill_check` returns structured error for ineligible skills
- [x] 7.3 Test `InnerMonologueService`: verify 2-call cap stops the tool-loop
- [x] 7.4 Test `InnerMonologueService`: verify errors are caught and logged without re-throwing

## 8. Frontend — INNER_VOICE Rendering

- [x] 8.1 Handle `INNER_VOICE` chunk type in the `dmStream` subscription handler — accumulate text the same way as `NARRATIVE_CHUNK`
- [x] 8.2 Make second `DONE` idempotent — if session is already idle, ignore without error
- [x] 8.3 Render accumulated inner voice text below the DM narrative block in italics with a muted visual style, clearly distinct from DM narrative
