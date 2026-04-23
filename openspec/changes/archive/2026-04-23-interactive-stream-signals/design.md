## Context

The change wires two interaction patterns that already exist in fragments across the app but do not yet function end-to-end:

1. The DM stream schema already defines `SUGGESTED_ACTION` chunks and the system prompt already asks the LLM to suggest next actions, but no backend tool or orchestration path emits those chunks.
2. The game engine can trigger state transitions that require player follow-up outside the freeform text loop, specifically level-up choices and prepared-spell selection, but the DM stream has no explicit pause signal for the frontend to react to.

This is a cross-cutting change because it touches LLM tool definitions, stream orchestration, and the Nuxt game view. The design needs to preserve the current SSE subscription contract, avoid introducing extra session-locking state, and keep tool-call behavior recoverable for the LLM.

## Goals / Non-Goals

**Goals:**
- Add a supported `suggest_actions(actions: string[])` tool path that emits `SUGGESTED_ACTION` chunks to the active DM stream.
- Emit explicit `STATUS` stream chunks for level-up and spell-preparation pauses so the frontend can freeze freeform input and open the correct UI.
- Keep these signals transient and stream-driven so the current session model and persistence layer do not need new pause-state tables or fields.
- Ensure orchestration behavior is predictable: pause signals and suggested actions are side effects for the client, not additional narrative text the LLM must parse back in the same turn.

**Non-Goals:**
- Persisting suggested actions for later replay or restoring them after reconnect.
- Adding a generic workflow engine for all future session interruption types.
- Introducing backend enforcement that hard-blocks other mutations while the UI is paused.
- Redesigning the existing level-up or spell-preparation UI beyond wiring open/close behavior to stream signals.

## Decisions

### Use explicit tool calls for stream-only side effects

The backend will add two game-engine tools:
- `suggest_actions(actions: string[])`
- `trigger_spell_prep(characterId)`

`trigger_level_up` remains the existing state-changing tool and gains a follow-up stream signal.

Rationale:
- This keeps the prompt contract explicit. The LLM should deliberately choose when to suggest actions or pause for a player workflow instead of relying on brittle text parsing.
- It matches the existing architecture where the game engine owns tool-call semantics and the orchestrator owns stream emission.

Alternatives considered:
- Infer suggested actions from final DM text. Rejected because it is prompt-fragile and would produce inconsistent UI.
- Reuse `prepare_spells` as both the state change and pause signal. Rejected because the pause must happen before the player submits prepared spells, not after the preparation mutation completes.

### Treat `suggest_actions` as a terminal stream-side tool result

When the orchestrator intercepts `suggest_actions`, it will emit one `SUGGESTED_ACTION` chunk per action and then end that tool branch without feeding an artificial tool result back into the LLM for additional narration in the same interaction step.

Rationale:
- The proposal defines `suggest_actions` as a UI affordance at the end of a narrative turn, not as data the model needs to continue reasoning over.
- Keeping it terminal avoids accidental loops where the model suggests actions, receives those actions as tool output, and then continues generating more text or more tool calls.

Alternatives considered:
- Return a structured success payload to the LLM after emitting chunks. Rejected because it adds no useful information and creates room for extra unintended output.
- Handle suggested actions entirely in the game-engine module. Rejected because chunk emission is part of stream orchestration and already belongs at the orchestration layer.

### Represent pauses as free-form `STATUS` chunk values instead of a new enum or persisted state

The stream will emit:
- `STATUS` with `status: "LEVEL_UP_PENDING"` after `trigger_level_up` completes its current work
- `STATUS` with `status: "SPELL_PREP_PENDING"` after `trigger_spell_prep` executes

The frontend will interpret those values to freeze text input and open the matching panel/modal. Input is unfrozen after successful `applyLevelUp` or `prepareSpells`.

Rationale:
- The existing stream contract already has a `STATUS` chunk with a string field, so this extends the current design without schema churn or extra persistence.
- These pauses are UI workflow hints, not authoritative domain state. The durable state remains in the character/campaign data mutated by the existing gameplay operations.

Alternatives considered:
- Add a backend session lock or stored pause flag. Rejected because the app is not yet deployed, the workflow does not require multi-client coordination, and the extra state would add complexity without clear benefit.
- Add new chunk types like `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING`. Rejected because the generic `STATUS` type already exists and is the better extension point.

### Keep pause handling optimistic on the frontend

The frontend will freeze the text input based on incoming status chunks and unfreeze after the relevant mutation succeeds. It will not wait for a second "resume" stream event from the backend.

Rationale:
- The next player-driven mutation is already the natural completion point for the paused flow.
- This keeps the backend stateless with respect to UI pause lifecycles and avoids adding resume events that can be dropped or duplicated.

Alternatives considered:
- Emit a dedicated resume status from the backend after each mutation. Rejected because it couples non-stream mutations back to the DM stream and complicates sequencing.

### Scope suggested actions to the current rendered DM turn

Suggested action chips will render below the latest DM narrative block associated with the active stream response. Selecting a chip pre-fills the input field rather than auto-submitting it.

Rationale:
- Prefill preserves player agency and lets the player edit the suggestion before sending.
- Scoping chips to the latest response avoids ambiguity when several streamed turns already exist in the session log.

Alternatives considered:
- Auto-submit suggested actions on tap. Rejected because it is too aggressive for a text-based RPG interaction model.
- Show chips as a global footer independent of message grouping. Rejected because it weakens the association between the DM’s latest response and the offered options.

## Risks / Trade-offs

- `[Suggested actions emitted too early or multiple times]` -> Restrict the tool prompt guidance to end-of-turn use and ensure the frontend replaces chips for the active response instead of accumulating duplicates indefinitely.
- `[Pause status lost on reconnect]` -> Accept this for now because pause signals are transient UI events; the follow-up screens can still be entered through existing player actions if needed.
- `[Terminal suggest_actions prevents additional narration some prompts might expect]` -> Document the tool as an end-of-turn affordance and update prompt instructions so the model emits it only after the narrative response is complete.
- `[Free-form status strings drift between frontend and backend]` -> Centralize the string constants in shared frontend/backend-adjacent code where practical, or at minimum keep them documented in the GraphQL stream type definitions and tests.

## Migration Plan

No database migration is required.

Implementation rollout:
1. Add the new tool definitions and extend the relevant existing tool handler(s) in the API.
2. Update DM orchestration so `suggest_actions` emits `SUGGESTED_ACTION` chunks and terminates cleanly.
3. Extend stream contract tests to cover the new chunk/status behavior.
4. Wire the Nuxt game view to render action chips and respond to pause statuses.
5. Verify that `applyLevelUp` and `prepareSpells` clear the paused UI state locally after success.

Rollback strategy:
- Remove the new tool registrations and ignore the new status values in the frontend.
- Because the change is additive and does not alter persisted data, rollback is code-only.

## Open Questions

- Should suggested action chips survive a manual page refresh within the same session, or is transient per-stream rendering sufficient for the current UX?
- Does spell preparation need different copy or modal behavior by class, or can the initial implementation use one generic prepared-spells entry point for Wizard, Cleric, and Druid?
