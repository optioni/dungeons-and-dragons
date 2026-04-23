## 1. suggest_actions Tool

- [x] 1.1 Add `suggest_actions` tool definition to `DM_TOOLS` in `dm-orchestrator.service.ts` with `actions: string[]` input schema
- [x] 1.2 Extend `runToolLoop` in `dm-orchestrator.service.ts` to intercept `suggest_actions` calls: emit one `SUGGESTED_ACTION` chunk per action, skip the tool-result feedback to the LLM, and exclude the tool from `toolResults` passed back to the model
- [x] 1.3 Write unit test verifying `suggest_actions` emits N `SUGGESTED_ACTION` chunks for N actions and does not append a tool result to the next loop

## 2. trigger_spell_prep Tool

- [x] 2.1 Add a `TriggerSpellPrepHandler` in `apps/api/src/game-engine/tools/trigger-spell-prep.handler.ts` that validates the character is a spell-preparing class (Wizard, Cleric, Druid) and returns structured success or error
- [x] 2.2 Register `trigger_spell_prep` in `GameEngineToolRegistrar.registerLevelingTools()` pointing at the new handler
- [x] 2.3 Add `trigger_spell_prep` tool definition to `DM_TOOLS` in `dm-orchestrator.service.ts` with `character_id` input schema
- [x] 2.4 Extend `runToolLoop` to emit a `STATUS` chunk with `status: "SPELL_PREP_PENDING"` after dispatching `trigger_spell_prep` (following the same tool-result path as other state-changing tools)
- [x] 2.5 Write unit tests for the handler covering valid prepared-caster and non-prepared-caster cases

## 3. LEVEL_UP_PENDING Status Signal

- [x] 3.1 Extend `runToolLoop` in `dm-orchestrator.service.ts` to emit a `STATUS` chunk with `status: "LEVEL_UP_PENDING"` after dispatching `trigger_level_up` successfully (i.e. when `result.success === true`)
- [x] 3.2 Write unit test verifying the status chunk is emitted after a successful `trigger_level_up` dispatch and is not emitted when the tool returns an error

## 4. Stream Contract Tests

- [x] 4.1 Add or update integration/unit tests covering `SUGGESTED_ACTION` chunk delivery order and content
- [x] 4.2 Add tests verifying `STATUS` chunks with `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING` are emitted at the correct points in the tool loop

## 5. Web — Suggested Action Chips

- [x] 5.1 In the play route, accumulate `SUGGESTED_ACTION` chunks from the active DM stream subscription into a reactive `suggestedActions` ref scoped to the current turn response
- [x] 5.2 Render suggested action chips below the latest in-progress DM narrative block; clear chips when a new player turn begins
- [x] 5.3 Wire chip tap/click to pre-fill the player text input without auto-submitting

## 6. Web — Level-Up Panel (stream-driven)

- [x] 6.1 In the play route, watch for `STATUS` chunks with `status === "LEVEL_UP_PENDING"` and set a reactive `levelUpPending` flag
- [x] 6.2 Disable the player text input and submit button while `levelUpPending` is true
- [x] 6.3 Open the existing level-up panel/overlay when `levelUpPending` becomes true
- [x] 6.4 Clear `levelUpPending` and re-enable input after the `applyLevelUp` mutation succeeds

## 7. Web — Spell Preparation Modal (stream-driven)

- [x] 7.1 In the play route, watch for `STATUS` chunks with `status === "SPELL_PREP_PENDING"` and set a reactive `spellPrepPending` flag
- [x] 7.2 Disable the player text input and submit button while `spellPrepPending` is true
- [x] 7.3 Open the spell-preparation selection UI when `spellPrepPending` becomes true
- [x] 7.4 Clear `spellPrepPending` and re-enable input after the `prepareSpells` mutation succeeds
