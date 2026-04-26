## 1. API — Enums and DTOs

- [x] 1.1 Add `DICE_ROLL` to `EventType` enum in `apps/api/src/session/session.enums.ts`
- [x] 1.2 Add `PENDING_CHECK` to `DmStreamChunkType` enum in `apps/api/src/session/dto/dm-stream-chunk.dto.ts`
- [x] 1.3 Add `pendingCheck` field (`{ skill?: string, ability?: string, dc: number } | undefined`) to `DmStreamChunk` DTO

## 2. API — suggest_actions Tool

- [x] 2.1 Extend `suggest_actions` tool schema in `DmOrchestrator` to include optional `pending_check: { skill?: string, ability?: string, dc: number }`
- [x] 2.2 Update `handleSuggestActions()` to parse `pending_check` and emit a `PENDING_CHECK` stream chunk before the `SUGGESTED_ACTION` chunks when present

## 3. API — DICE_ROLL Event Persistence

- [x] 3.1 In `DmOrchestrator`, after dispatching `check_skill`, append a `DICE_ROLL` game event with `{ tool, skill, roll, modifier, total, dc, passed }` — only when the tool result is successful
- [x] 3.2 In `DmOrchestrator`, after dispatching `check_ability`, append a `DICE_ROLL` game event with `{ tool, ability, roll, modifier, total, dc, passed }` — only when successful
- [x] 3.3 In `DmOrchestrator`, after dispatching `roll_dice`, append a `DICE_ROLL` game event with `{ tool, expression, rolls, total }` — only when successful

## 4. API — System Prompt

- [x] 4.1 Add instruction to the DM system prompt: when calling `suggest_actions` at a moment that will require a skill or ability check, include `pending_check` with the anticipated skill/ability and DC

## 5. Web — GraphQL Fragment

- [x] 5.1 Verify `DICE_ROLL` events are returned by the existing `gameEvents` query (no resolver change needed — filtered by session)
- [x] 5.2 Add `DICE_ROLL` to the events GraphQL fragment in `apps/web/graphql/session.ts` so the frontend receives these events

## 6. Web — Pending Check State

- [x] 6.1 Add `pendingCheck` ref (`{ skill?: string, ability?: string, dc: number } | null`) to `play.vue`
- [x] 6.2 Handle `PENDING_CHECK` chunk in the stream switch: set `pendingCheck.value`
- [x] 6.3 Clear `pendingCheck.value` in `handleSend()` alongside `suggestedActions.value = []`

## 7. Web — Pending Check UI

- [x] 7.1 Render the pending check hint above suggested action buttons in `play.vue` when `pendingCheck` is non-null: IM Fell English italic muted, showing skill/ability name and DC (e.g. "a Persuasion check awaits · DC 12")

## 8. Web — Roll Card Component

- [x] 8.1 Create `apps/web/components/session/DiceRollCard.vue` — accepts a `DICE_ROLL` event content object as a prop
- [x] 8.2 Render skill/ability check variant: `border-l-2 border-grimoire-accent-dim/40`, Cinzel xs label (e.g. "PERSUASION CHECK · DC 12"), font-mono roll breakdown (e.g. "14 + 3 = 17"), ✦/✕ pass/fail glyph in appropriate grimoire colour
- [x] 8.3 Render roll_dice variant: Cinzel xs label (e.g. "ROLL · 2d6+3"), font-mono individual rolls and total, no pass/fail indicator
- [x] 8.4 Apply `.grimoire-entry` animation on mount (guard with `mounted` ref)

## 9. Web — Transcript Integration

- [x] 9.1 Add `DICE_ROLL` case to the event renderer in `TranscriptView.vue`, rendering `<session-dice-roll-card>` for these events
- [x] 9.2 Verify transcript ordering: `DICE_ROLL` events appear between the `PLAYER_INPUT` and `DM_NARRATIVE` events that bracket each roll
