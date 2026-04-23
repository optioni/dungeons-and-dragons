## Why

Two DM stream features are designed but not wired up. First, `SUGGESTED_ACTION` is defined in `DmStreamChunkType` and the system prompt instructs the LLM to emit action chips, but no code ever emits that chunk type — the type is dead infrastructure. Second, `trigger_level_up` is described as "pausing the session for the player to choose abilities" but the stream has no pause mechanism and the frontend has no signal to freeze input and show the level-up panel. The same gap applies to `prepare_spells` for Wizard/Cleric/Druid after long rest.

## What Changes

**Suggested actions:**
- `suggest_actions(actions: string[])` tool added to the game engine tool list — the LLM calls this at the end of a narrative turn to propose player options.
- When intercepted mid-stream, the tool handler emits one `SUGGESTED_ACTION` chunk per action (using the existing `action` field on `DmStreamChunk`).
- Frontend renders chips below the latest DM narrative block; tapping a chip pre-fills the input field.

**Session pause signals:**
- `trigger_level_up` tool handler now additionally emits a `STATUS` chunk with `status: 'LEVEL_UP_PENDING'` after performing its existing work.
- `prepare_spells` tool gains a companion `trigger_spell_prep(characterId)` tool — emitted before the player selects spells — which emits `STATUS` chunk with `status: 'SPELL_PREP_PENDING'`.
- Frontend subscribes to STATUS chunks: `LEVEL_UP_PENDING` → freeze text input, open level-up panel (already planned in `web-game-view`); `SPELL_PREP_PENDING` → freeze text input, open spell selection modal.
- After the player submits `applyLevelUp` or `prepareSpells` mutations successfully, the frontend unfreezes input. No backend session lock is needed — the LLM simply waits for the next player turn.

## Capabilities

### New Capabilities
- `suggest-actions-tool`: `suggest_actions` LLM tool → emits SUGGESTED_ACTION stream chunks → frontend renders action chips.
- `session-pause-signals`: STATUS chunk variants `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING` signal the frontend to freeze input and open the appropriate panel.
- `trigger-spell-prep-tool`: `trigger_spell_prep` tool that emits `SPELL_PREP_PENDING` before Wizard/Cleric/Druid spell selection.

### Modified Capabilities
- `game-engine`: `trigger_level_up` emits LEVEL_UP_PENDING STATUS chunk post-execution.
- `llm-orchestration`: `suggest_actions` tool call intercepted and converted to SUGGESTED_ACTION chunks (not passed back to LLM as a tool result — it is a terminal tool in the turn).
- `web-game-view`: Input freeze + panel open/close wired to STATUS chunk values; action chips rendered below DM narrative.

## Impact

- `GameEngineModule` — new `suggest_actions` and `trigger_spell_prep` tool handlers; `trigger_level_up` handler extended to emit STATUS chunk
- `DmStreamChunkType` — document `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING` as valid `status` string values (enum not needed — free-form string on STATUS chunk)
- `DmOrchestrator` — `suggest_actions` is a terminal tool: emit chunks, do not continue stream
- Frontend — action chip component below DM narrative; input freeze logic on STATUS; spell selection modal
- Depends on `session-and-llm`, `game-engine`, `web-game-view` (for UI components)
