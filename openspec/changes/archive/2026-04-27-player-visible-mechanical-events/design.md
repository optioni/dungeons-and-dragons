## Context

The DM runtime already persists raw `TOOL_CALL` events for model continuity and debugging. The play UI intentionally does not render those raw events, because tool names, inputs, and result payloads are implementation details and may contain hidden state. `dice-roll-visibility` established the better product pattern: derive a player-facing event from a successful tool result, persist it in `game_event`, and render it with a purpose-built UI treatment.

This change generalizes that pattern for non-dice mechanical consequences. The audience is the player in the active play route, not an operator reviewing logs. The visible event layer should make the game feel legible and fair while preserving the Dark Grimoire narrative tone and avoiding transcript clutter.

Current relevant surfaces:
- `GameEvent.content` is jsonb, so new player-visible payloads can be additive.
- `TranscriptView` renders only known event types (`PLAYER_INPUT`, `DM_NARRATIVE`, `DICE_ROLL`) plus live stream buffers.
- `CombatPanel` is already the player-facing combat state surface.
- `game-events-pagination` is active in parallel, so this design should not depend on full-history refetches after every turn.

## Goals / Non-Goals

**Goals:**
- Persist curated player-visible mechanical events in session history.
- Keep raw `TOOL_CALL` events internal and never render them directly.
- Give combat consequences a primary home in the combat panel or combat feed.
- Render non-combat story milestones as restrained transcript annotations.
- Ensure hidden DCs, hidden enemy stats, memory operations, background faction logic, and unrevealed world events do not leak through visible event payloads.
- Keep the visual language consistent with Dark Grimoire: marginal annotations, warm parchment text, gold accents used sparingly, no modern toast/feed chrome.

**Non-Goals:**
- Adding a player setting for mechanical verbosity.
- Showing every successful tool call.
- Replacing narrative prose with mechanical logs.
- Backfilling visible events for historical sessions.
- Exposing developer/operator diagnostics in the player UI.
- Designing a full quest, inventory, or map page redesign.

## Decisions

### 1. Use one normalized `PLAYER_VISIBLE_EVENT` type

**Decision:** Add one durable event type, `PLAYER_VISIBLE_EVENT`, whose `content` has a normalized discriminated shape:

```ts
{
  category: 'COMBAT' | 'INVENTORY' | 'QUEST' | 'DISCOVERY' | 'TRAVEL' | 'RESOURCE'
  kind: string
  title: string
  summary?: string
  entities?: Array<{ type: string; id?: string; name: string }>
  values?: Record<string, string | number | boolean>
}
```

The `kind` field carries stable renderer-level semantics, for example `DAMAGE_APPLIED`, `ITEM_GAINED`, `QUEST_OBJECTIVE_UPDATED`, `LOCATION_DISCOVERED`, `DUNGEON_ENTERED`, or `SPELL_SLOT_USED`.

**Why this over one enum per category?** Dice rolls have a specialized numerical breakdown and already justify `DICE_ROLL`. The next layer has many small event kinds with similar display needs. A normalized event avoids enum sprawl while keeping raw tool payloads out of the UI.

**Alternative considered:** Render from `TOOL_CALL` jsonb on the frontend. Rejected because it couples UI to tool implementation details, risks leaking hidden inputs, and makes player-safe redaction much harder to test.

### 2. Centralize mapping after successful tool dispatch

**Decision:** Add a backend mapper near `DmOrchestrator` that receives `toolName`, `toolInput`, and structured `toolResult` after the raw `TOOL_CALL` event is appended. If the tool succeeded and maps to a player-visible event, the mapper returns sanitized `PLAYER_VISIBLE_EVENT` payloads for persistence.

Flow:

```text
Claude tool_use
    │
    ▼
ToolRegistry.dispatch(...)
    │
    ├─ append TOOL_CALL          internal record
    │
    ├─ map successful result     player-safe classification
    │
    ├─ append PLAYER_VISIBLE_EVENT(s)
    │
    └─ publish existing stream signals where needed
```

The mapper should be deterministic and conservative. If a result lacks enough player-safe detail to summarize the consequence, it returns no visible event rather than guessing from hidden inputs.

### 3. Treat visibility as witnessed consequence, not tool category

**Decision:** A tool result is visible only when the character directly experiences or observes the consequence. This rule is more important than the tool name.

Default visible mappings:

| Category | Tool outcomes | Visible example |
|---|---|---|
| Combat | `start_combat`, `end_combat`, `apply_damage`, `heal`, `apply_condition`, `remove_condition`, `roll_death_save`, `instant_death` | "Mira takes 7 slashing damage" |
| Inventory | `give_item`, `take_item`, `buy_item`, `sell_item`, `equip_item`, `unequip_item` | "Gained Tarnished silver key" |
| Resource | `use_spell_slot`, `take_short_rest`, `take_long_rest`, `apply_level_up` | "Expended 1st-level spell slot" |
| Quest | `create_quest`, `update_quest_objective`, `complete_quest`, `fail_quest` | "Quest updated: Find the missing courier" |
| Discovery | `discover_location`, player-witnessed `create_location`, `enter_dungeon`, `exit_dungeon` | "Discovered Blackfen Crossing" |
| Travel | `travel_to`, `move_to_room` when player-directed | "Arrived at Blackfen Crossing" |

Default hidden mappings:

| Tool area | Reason |
|---|---|
| `record_memory`, `search_memories`, `record_npc_memory` | Internal context machinery |
| NPC agenda/faction/world tick internals | Often hidden world simulation |
| `advance_antagonist_stage`, hidden `shift_faction_disposition` | Spoils off-screen state |
| `create_npc`, `create_item`, `record_lore` | Usually bookkeeping unless the narrative has revealed the entity |
| Failed tool results | They are recovery information for the LLM, not player events |

### 4. Combat events belong primarily in `CombatPanel`

**Decision:** `PLAYER_VISIBLE_EVENT` rows with `category: 'COMBAT'` are durable and queryable, but the primary live surface is the combat panel. The panel may include a compact event feed beneath initiative or near the affected combatant. The transcript should not receive a large annotation for every damage or condition event during combat.

Combat event feed treatment:
- Dense rows, not cards.
- Cinzel micro-label for kind and round.
- IM Fell English or compact text for the affected entity.
- Font mono only for numbers.
- Use `grimoire-accent` for the current turn or important player-owned event; use muted text for routine enemy changes.

Transcript treatment is reserved for major combat milestones: combat starts, combat ends, death save outcomes, character death, and possibly a boss defeated event.

### 5. Non-combat milestones render as marginal transcript annotations

**Decision:** `INVENTORY`, `QUEST`, `DISCOVERY`, `TRAVEL`, and non-combat `RESOURCE` events render in `TranscriptView` as small marginal annotations, visually closer to `DiceRollCard` than to a panel.

Visual shape:

```text
▏ QUEST UPDATED
▏ Find the missing courier · Second clue discovered
```

Implementation direction:
- `border-l-2 border-grimoire-accent-dim/40 pl-5 py-1 my-3`
- label: Cinzel xs uppercase tracking-widest `text-grimoire-muted`
- summary: IM Fell English small/normal `text-grimoire-muted/80`
- values: `font-mono` only for quantities, HP, spell slot levels, or coin amounts
- apply `.grimoire-entry` only after mount
- no bright success/error colors, no rounded card containers, no toast-style UI

This keeps the transcript readable as a tome with annotations rather than a chat log mixed with app notifications.

### 6. Batch most visible events into persisted reconciliation

**Decision:** Persist visible events during tool dispatch, then let the frontend pick them up through the normal end-of-turn event reconciliation. Do not add a new stream chunk for every visible event.

Live stream exceptions remain appropriate for UI that must react immediately:
- existing `STATUS` chunks for blocking flows
- `CAMPAIGN_ENDED`
- scene/combat shell changes already represented in durable session state

This avoids mid-sentence transcript interruptions and aligns with `game-events-pagination`, where the turn-completion path should append newly persisted events rather than replace the whole transcript.

### 7. Keep payloads player-safe by construction

**Decision:** Visible event payloads are authored summaries, not redacted copies of tool input or result payloads. Mapper tests should assert both positive mapping and absence of sensitive fields.

Do not include:
- hidden DCs or enemy passive stats
- raw tool inputs
- raw tool result envelopes
- undiscovered location names
- unrevealed NPC agenda or faction state
- memory search text or retrieved memories
- raw prompt/model content

When in doubt, prefer generic wording such as "A hidden consequence changes elsewhere" only if the player witnesses the consequence. Otherwise, emit no event.

## Risks / Trade-offs

- **Transcript clutter** -> Keep combat details in the combat panel and use transcript annotations only for durable milestones.
- **Leaking hidden state** -> Use authored mapper payloads and tests that reject raw payload pass-through.
- **Mapper drift as tools evolve** -> Keep mapping centralized and require new tool result shapes to opt into visible events explicitly.
- **Duplicating narrative prose** -> Visible events should summarize mechanical consequence, not restate the DM's paragraph.
- **Pagination interaction** -> End-of-turn reconciliation must append newly persisted events in order; full refetch assumptions should not be baked into this feature.
- **Ambiguous visibility** -> Default to hidden when the mapper cannot prove the player should know the result.

## Migration Plan

1. Add `PLAYER_VISIBLE_EVENT` to the session event enum and GraphQL enum.
2. Add a typed mapper service or helper near session orchestration with focused unit coverage.
3. Persist mapped events immediately after successful `TOOL_CALL` persistence.
4. Extend the frontend GraphQL event typing to include the new event kind.
5. Add `MechanicalEventAnnotation` for non-combat transcript events using Dark Grimoire marginalia styling.
6. Add a compact combat event feed or affected-row event treatment in `CombatPanel`.
7. Update turn-completion reconciliation to include newly persisted visible events without requiring a full-history replacement.
8. Add UI tests for transcript annotations and combat-panel events.

Rollback is simple while the app is undeployed: remove the mapper and renderer, and ignore or delete any `PLAYER_VISIBLE_EVENT` rows from local dev data. Existing raw `TOOL_CALL` and narrative events remain unchanged.

## Open Questions

None blocking. The proposal decisions establish the product direction: persisted events, combat-panel-first display, player-relevant information only, end-of-turn batching by default, and one curated visibility level.
