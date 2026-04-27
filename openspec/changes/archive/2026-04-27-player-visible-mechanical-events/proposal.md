## Why

Dice roll visibility makes the DM's mechanical adjudication feel fair, but other important tool-driven consequences still disappear into narrative prose or generic `TOOL_CALL` rows. Players should be able to review the durable mechanical moments that affected them without seeing raw tool plumbing or hidden DM state.

## What Changes

- Add a curated player-visible mechanical event layer on top of existing LLM tool execution.
- Persist player-visible events as durable `GameEvent` rows so they survive reloads and remain part of session history.
- Keep raw `TOOL_CALL` events internal; the UI renders explicit player-facing event types or normalized visible event payloads instead of parsing arbitrary tool results.
- Map only successful, player-relevant tool outcomes into visible events:
  - combat effects: damage, healing, conditions, death saves, combat start/end
  - inventory and resource changes: items gained/lost/bought/sold/equipped, spell slots used
  - quest progress: quest created, objective updated, quest completed/failed
  - travel and discovery: travel completed, location discovered, dungeon entered/exited
- Use the combat panel as the primary surface for combat events, with a compact combat log or state feed where useful.
- Render non-combat milestones as restrained transcript annotations when they are story-relevant: item gained, quest updated, location discovered, dungeon entered/exited.
- Hide memory operations, searches, background bookkeeping, NPC agenda/faction internals, and unrevealed world consequences unless the player directly witnesses the result.
- Batch most non-blocking visible events into the end-of-turn reconciliation path, while still allowing live stream signals for UI that must react immediately.
- Keep one curated default visibility level; no player-facing verbosity setting in this change.

## Capabilities

### New Capabilities

- `player-visible-mechanical-events`: Curated durable events derived from successful tool results, including event taxonomy, visibility rules, payload shape, and hidden-state safeguards.

### Modified Capabilities

- `game-session`: `GameEvent` history gains additional player-visible mechanical event types or a normalized visible-event payload, returned in chronological order with the transcript.
- `game-view-ui`: The play route renders non-combat visible mechanical events as restrained transcript annotations and reconciles them from persisted history.
- `combat-ui`: Combat-visible mechanical events primarily update the combat panel and combat log rather than cluttering the narrative transcript.
- `game-engine`: Successful player-relevant tool results are mapped into curated visible events, while non-player-facing tool calls remain internal.
- `quest-ui`: Quest progress events can be surfaced as player-facing quest annotations or refreshed quest state.
- `world-map-ui`: Discovery and travel events can refresh map state and display discovered-location feedback without leaking undiscovered locations.

## Impact

- **API session model**: new `EventType` values or a normalized `PLAYER_VISIBLE_EVENT` shape stored in existing `game_event.content` jsonb; no database migration expected unless enum handling requires it.
- **DM orchestration**: `DmOrchestrator` or a small mapping service classifies successful tool results into player-visible events after `TOOL_CALL` persistence.
- **Game engine tools**: tool result envelopes may need enough structured data to produce player-safe visible summaries without exposing hidden inputs.
- **GraphQL**: `gameEvents` continues returning persisted session history; frontend fragments/types must include any new event enum values and payloads.
- **Frontend play route**: transcript rendering gains non-combat milestone annotations; turn-completion reconciliation includes visible mechanical events.
- **Combat panel**: combat effects become inspectable in panel state or a compact combat event feed.
- **Design constraint**: raw tool payloads, hidden DCs, hidden enemy stats, background memory/search operations, faction agenda changes, and unrevealed world events must not leak into player-visible UI.
