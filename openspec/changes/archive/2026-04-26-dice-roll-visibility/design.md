# Design: Dice Roll Visibility

## Context

When the DM calls `check_skill`, `check_ability`, or `roll_dice`, the result is dispatched as a `TOOL_RESULT` stream chunk and stored as a `TOOL_CALL` game event — but never surfaced in the UI. The frontend `case 'TOOL_RESULT': break` silently discards it. The player sees the narrative consequence but not the numbers that determined it.

This design adds two UI moments:

1. **Pending check hint** — when `suggest_actions` includes a `pending_check`, show a subtle typographic annotation above the action buttons telegraphing what roll is at stake.
2. **Roll card** — when a dice tool fires, persist a `DICE_ROLL` game event and render it as a marginalia-style annotation in the transcript, between the player's action and the DM's narrative.

---

## Goals / Non-Goals

**Goals:**
- Show the player the d20 roll, modifier, total, DC, and pass/fail for every `check_skill` and `check_ability` call
- Show totals only (no breakdown) for `roll_dice`
- Persist roll cards in the transcript so they survive page reload
- Show a pending check hint (skill + DC) alongside action buttons when the DM signals one is coming
- Clear the pending check hint when the player sends any input

**Non-Goals:**
- Showing what the DM rolled *against* (NPC passive stats, hidden DCs not set by `check_skill`)
- Retroactively backfilling `DICE_ROLL` events for existing sessions
- Animating the die roll (no d20 spinning animation — keep it typographic)
- Blocking the player from typing free input when a pending check is shown

---

## Decisions

### 1. Persist as a new `EventType.DICE_ROLL` (not stream-only)

**Decision:** Add `DICE_ROLL` to the `EventType` enum and persist a game event whenever a dice tool fires. No new DB column or migration — `content` is already `jsonb`.

**Alternatives considered:**
- *Stream-only (ephemeral)*: Zero backend changes, but rolls disappear on reload. Scrolling back through a session and seeing "You spin a tale" with no visible roll breaks the mechanical honesty the feature is meant to create.
- *Store in the existing `TOOL_CALL` event, query it*: Possible but fragile — `TOOL_CALL` events include all tools, so the frontend would need to filter by `toolName` inside jsonb. A dedicated `DICE_ROLL` type is cleaner to query and render.

**Content shape per tool:**

```ts
// check_skill / check_ability
{
  tool: 'check_skill' | 'check_ability',
  skill?: string,      // e.g. "Persuasion"
  ability?: string,    // e.g. "CHA"
  roll: number,        // d20 result
  modifier: number,
  total: number,
  dc: number,
  passed: boolean,
}

// roll_dice
{
  tool: 'roll_dice',
  expression: string,  // e.g. "2d6+3"
  rolls: number[],
  total: number,
}
```

### 2. Persist `DICE_ROLL` in the orchestrator, not in the tool handler

**Decision:** `DmOrchestrator` already intercepts all tool results before feeding them back to Claude. Persist the `DICE_ROLL` event there, immediately after the existing `TOOL_CALL` event append, when `block.name` is one of the three dice tools.

**Why not in the tool handler (DiceChecksService)?** The handlers don't own the session — they return structured results. Persistence belongs in the orchestrator layer that manages the session event log.

### 3. `suggest_actions` schema gains optional `pending_check`

**Decision:** Extend the tool schema with:
```ts
pending_check?: {
  skill?: string   // e.g. "Persuasion"
  ability?: string // e.g. "CHA" — mutually exclusive with skill
  dc: number
}
```

`handleSuggestActions` parses this and emits it on each `SUGGESTED_ACTION` chunk (or a single `PENDING_CHECK` chunk before the action chunks — see below).

**Alternatives considered:**
- *Single `PENDING_CHECK` chunk*: Cleaner to handle on the frontend (one piece of state to set). Chosen over attaching it to every `SUGGESTED_ACTION` chunk.
- *Separate `announce_check` tool*: More DM prompt complexity, more tool calls. The `pending_check` field on `suggest_actions` keeps it co-located with the decision moment.

**Chosen:** Emit one new `DmStreamChunkType.PENDING_CHECK` chunk (with `pendingCheck: { skill?, ability?, dc }`) before the action chunks if `pending_check` is present.

### 4. UI: Roll card as marginalia, not a panel

**Decision:** The roll card is a typographic inline annotation, not a card or modal. It sits in the transcript flow between the player action and the DM narrative, styled to feel like a mechanical notation stamped into the margin of the tome.

**Visual anatomy:**

```
border-l-2 border-grimoire-accent-dim/40  pl-5  py-1  my-3
│
│  PERSUASION CHECK · DC 12                ← Cinzel xs tracking-widest text-grimoire-muted
│  14  +  3  =  17  · ✦ Passed            ← font-mono numbers, grimoire-accent glyph+text
```

Failure variant: replace `✦ Passed` with `✕ Failed` in `text-grimoire-muted/70`.

Apply `.grimoire-entry` for the fade-in reveal (same as narrative blocks).

**For `roll_dice` (no DC):**
```
│  ROLL · 2d6+3                            ← Cinzel xs muted
│  3 · 5  +  3  =  11                     ← individual rolls in mono, dimmer, then total
```

### 5. UI: Pending check hint above action buttons

**Decision:** A single line in IM Fell English italic, muted, placed between the narrative and the action buttons when `pending_check` is active.

```
*a Persuasion check awaits · DC 12*
```

Styled: `font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted/60 text-center`

Cleared (reset to `null`) in `handleSend` alongside `suggestedActions.value = []`.

### 6. `EventType.DICE_ROLL` events are fed back into the LLM context as-is

**Decision:** No change to `ContextLoader`. Dice roll events are already stored as `TOOL_CALL` events (which the context loader includes). The new `DICE_ROLL` event is purely for UI rendering — the LLM already gets the result through the existing `tool_result` message in the conversation.

### 7. DM system prompt: instruct to use `pending_check` when applicable

**Decision:** Add a short instruction to the DM system prompt (or the relevant prompt module): when calling `suggest_actions` at a moment that will require a skill or ability check, include `pending_check` with the anticipated skill/ability and DC. It is optional — omit it when the player action is free-form or the check is not predetermined.

---

## Roll Card Visual Reference

```
Dark Grimoire Transcript — annotated roll card

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Player action annotation: italic muted]                       │
│  Dax  You tell him you have information about Archivist Morrow  │
│                                                                 │
│  [Roll card: marginalia annotation]                             │
│  ▏ PERSUASION CHECK · DC 12                                     │
│  ▏ 14  +  3  =  17  · ✦ Passed                                 │
│                                                                 │
│  [OrnamentalDivider: ── ◇ ✦ ◇ ──]                              │
│                                                                 │
│  [DM narrative: IM Fell English prose-grimoire]                 │
│  His eyes sharpen. He steps aside...                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Risks / Trade-offs

- **Stale pending check** → Player ignores suggestions, types custom input. Pending check is discarded on send. The DM may or may not call a dice tool for the custom action — either way, only real tool results produce roll cards. No false roll is ever shown.
- **DM forgets `pending_check`** → Pending check hint simply never appears. The roll card still appears when the DM calls `check_skill` post-action. The hint is additive UX, not load-bearing.
- **`roll_dice` for non-skill rolls** → `roll_dice` is also used for damage, monster HP, random tables. Roll cards will appear for these too. The simpler display (expression + total, no DC/pass-fail) is appropriate for all of them.
- **Ordering: `DICE_ROLL` event vs narrative** → The orchestrator appends `DICE_ROLL` immediately when the tool fires, before Claude generates the narrative. The `DONE` chunk triggers a full event refetch, so ordering in the DB matches the transcript order.

---

## Migration Plan

1. Add `DICE_ROLL` to `EventType` enum — no DB migration needed
2. Add `PENDING_CHECK` to `DmStreamChunkType` enum
3. Add `pendingCheck` field to `DmStreamChunk` DTO
4. Extend `suggest_actions` tool schema in `DmOrchestrator`
5. Update `handleSuggestActions` to emit `PENDING_CHECK` chunk
6. Persist `DICE_ROLL` event in `DmOrchestrator` dice tool branch
7. Update GraphQL session query to include `DICE_ROLL` events (already included if queried by session — verify)
8. Update `TranscriptView` to render `DICE_ROLL` events
9. Update `play.vue` to handle `PENDING_CHECK` chunk and clear pending check on send
10. Update web GraphQL fragment to request `DICE_ROLL` event fields
11. Update DM system prompt with `pending_check` guidance

No rollback risk — `DICE_ROLL` is additive. Old sessions without these events render identically. New `EventType` value is a string in jsonb; existing queries are unaffected.

---

## Open Questions

- Should `roll_dice` rolls (damage, tables) show a roll card, or only `check_skill`/`check_ability`? Showing all is simpler and mechanically transparent, but damage rolls mid-combat may feel noisy. **Default: show all, revisit if combat feels cluttered.**
- Should the pending check hint show the DC to the player, or just the skill name? Showing DC is more transparent; hiding it preserves some tension. **Default: show DC — mechanical honesty is the goal of this feature.**
