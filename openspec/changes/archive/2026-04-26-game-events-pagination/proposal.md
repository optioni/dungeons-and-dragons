## Why

The `gameEvents` query returns the entire session history as a flat array, and a session accumulates roughly 5 events per player turn (player input + tool calls + DM narrative). At 100+ rows before the first quest, a full campaign easily reaches 500–2 000 events — all fetched on page load, all in the DOM simultaneously. Pagination bounds both the network payload and DOM size to the recent history the player actually needs.

## What Changes

- **BREAKING** `gameEvents(sessionId: ID!): [GameEvent!]!` → `gameEvents(sessionId: ID!, last: Int, before: String): GameEventConnection!`
- `GameEventConnection` / `GameEventEdge` relay types added (consistent with all other paginated queries)
- Default page size: 60 events (covers roughly 10–15 turns including tool calls)
- Frontend loads the last 60 events on session mount; intersection observer at the top of the scroll area triggers "load earlier" fetches
- Streaming `DONE` handler switches from full-refetch to appending the 1–5 new events directly from the subscription, so paginated state is preserved across turns
- Scroll position is anchored when prepending older events so the viewport does not jump

## Capabilities

### New Capabilities

- `game-events-pagination`: Relay cursor pagination for the game events transcript — args, resolver, connection type, default page size, and hasPreviousPage behaviour

### Modified Capabilities

- `game-session`: `gameEvents` field changes return type from `[GameEvent!]!` to `GameEventConnection!` and gains `last` / `before` arguments
- `game-view-ui`: Transcript scroll area gains "load earlier" trigger at the top; `persistedEvents` state transitions from full-replace-on-DONE to append; scroll anchor preservation on prepend

## Impact

- **API**: `SessionResolver.gameEvents` returns a Connection; `SessionService.getGameEvents` gains pagination parameters; new `GameEventConnection` / `GameEventEdge` ObjectTypes in `SessionModule`
- **GraphQL schema**: breaking change to `gameEvents` field — any client querying it must update to the connection shape
- **Frontend**: `GAME_EVENTS_QUERY` updated to connection query; `play.vue` event state management refactored (initial load, append on turn end, prepend on load-earlier); `TranscriptView` receives same `events` prop, no changes needed there
- **No migration**: `game_event` table is unchanged; only query behaviour changes
