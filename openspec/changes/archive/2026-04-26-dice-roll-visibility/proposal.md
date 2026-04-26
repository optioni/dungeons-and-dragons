## Why

Dice rolls happen invisibly — the DM calls `check_skill`, `check_ability`, or `roll_dice` but the player never sees the numbers, making outcomes feel arbitrary rather than earned. Surfacing rolls in the transcript makes the game feel mechanically honest and lets players understand why something succeeded or failed.

## What Changes

- `suggest_actions` tool schema gains an optional `pending_check` field (`skill` or `ability` + `dc`) so the DM can telegraph an upcoming roll at decision points
- `SUGGESTED_ACTION` stream chunk carries the `pending_check` hint to the frontend
- Frontend shows a pending check indicator (skill name + DC) above action buttons when present; cleared on any player send
- New `EventType.DICE_ROLL` persisted to `game_event` when `check_skill`, `check_ability`, or `roll_dice` fires, storing roll, modifier, total, dc, passed
- Roll card rendered in the transcript (d20 + modifier + total + pass/fail) for `DICE_ROLL` events
- DM system prompt updated to include `pending_check` when calling `suggest_actions` at moments that will require a skill or ability check
- The pending check is a UI hint only — if the player types custom input instead of using a suggestion, the DM reassesses independently and any roll that fires is still captured

## Capabilities

### New Capabilities
- `dice-roll-visibility`: Persisted dice roll events and frontend roll card rendering; pending check hint on suggested actions

### Modified Capabilities
- `suggest-actions`: `pending_check` field added to tool schema and stream chunk

## Impact

- `apps/api/src/session/session.enums.ts` — new `DICE_ROLL` EventType
- `apps/api/src/session/dto/dm-stream-chunk.dto.ts` — `pendingCheck` field on `DmStreamChunk`
- `apps/api/src/session/dm-orchestrator.service.ts` — persist `DICE_ROLL` event when dice tools fire; parse and forward `pending_check` in `handleSuggestActions`; update `suggest_actions` tool schema
- `apps/api/src/session/entities/game-event.entity.ts` — no entity change needed (content is jsonb)
- DB migration — none needed (jsonb content, new EventType is a string enum)
- `apps/web/pages/campaign/[id]/play.vue` — handle `TOOL_RESULT` for dice tools; show/clear pending check state
- `apps/web/components/session/TranscriptView.vue` — render `DICE_ROLL` events as roll cards
- DM system prompt (context-loader or prompt module) — instruction to include `pending_check` in `suggest_actions` at check moments
