## Context

`GameEvent` rows accumulate at roughly 5 per player turn (1 `PLAYER_INPUT` + 2–3 `TOOL_CALL` + 1 `DM_NARRATIVE`). The current `gameEvents` resolver returns the entire session history unbounded. At 100+ rows before the first quest, a full campaign reaches 500–2 000 events — all fetched and rendered on every page load.

The context loader (`context-loader.service.ts`) reads events directly via ORM and is unaffected by this change — it must always have the full history for LLM context assembly. Pagination only affects the GraphQL query consumed by the frontend.

All other list queries in the codebase already use relay cursor pagination via `GraphqlService.findAndPaginate`. This change brings `gameEvents` in line with that convention.

## Goals / Non-Goals

**Goals:**
- Bound the initial page load to the most recent ~60 events
- Allow the frontend to fetch older events on demand (scroll up to load earlier)
- Preserve scroll position when prepending older events
- Keep the post-turn state update simple and correct

**Non-Goals:**
- Forward pagination (the transcript always grows at the bottom; no use case for `after`/`first` on this query)
- Filtering events by type at the API level (the frontend decides what to render per `toolName`)
- Changing `context-loader.service.ts` — it reads the full history and must continue to do so

## Decisions

### Relax `CannotUseWithout(['before'])` on `last` in `ConnectionArgs`

The base `ConnectionArgs` currently requires `before` when `last` is set. This is overly strict — the relay spec allows `last` without `before` to mean "the last N items". `GraphqlService.findAndPaginate` already handles this case correctly (the `before` cursor condition is gated by `if (meta.before)`).

Removing the `@Validate(CannotUseWithout, ['before'])` decorator from `last` in `ConnectionArgs` makes the base type relay-correct and lets all connection args types use `last` alone for initial loads without needing per-query workarounds.

**Alternative considered:** A custom `GameEventsConnectionArgs` that skips the validator entirely. Rejected — it's a local workaround for a bug in the shared type. Fixing the shared type is cleaner and benefits any future query that needs `last` without a cursor.

### `GameEventsConnectionArgs` follows the existing pattern

A new `GameEventsConnectionArgs extends ConnectionArgs` adds the required `sessionId: ID!` field. Same shape as `CampaignsConnectionArgs`, `WorldConnectionArgs`, etc. No deviations.

### Default page size: 60

60 events covers roughly 10–15 turns of mixed exploration/combat (including tool calls). Enough for meaningful session context without over-fetching. The `last` arg defaults to 60 if omitted, so the frontend can omit it for the initial load.

### On DONE: replace window with `last: 60` refetch

After a turn completes, the DONE subscription handler already refetches events. With pagination, the refetch uses `last: 60` (no cursor) — replacing `persistedEvents` with the latest page. This is intentionally simple:

- The player is always at the bottom after a turn, so showing the latest page is correct
- Any "load earlier" history the player scrolled up to see is dropped — but new content arriving naturally resets the view to the present
- The local `PLAYER_INPUT` event (fake ID) is replaced by the real events from the refetch

**Alternative considered:** Append only new events after the last known event ID. This preserves loaded history but requires tracking the last real event cursor and merging by ID (handling the fake local event removal). The complexity is not worth it — resetting to the latest page on a new turn is the right UX anyway.

### Load-earlier: intersection observer at scroll container top

An `IntersectionObserver` watches a sentinel element at the top of the transcript scroll area. When it becomes visible (user scrolled near the top), the frontend fetches events with `before: <earliest loaded cursor>` and `last: 60`, then prepends to `persistedEvents`.

Scroll anchor preservation uses the `scrollHeight` delta approach:
```
prevHeight = scrollEl.scrollHeight
[prepend items]
nextTick: scrollEl.scrollTop += scrollEl.scrollHeight - prevHeight
```

**Alternative considered:** CSS `overflow-anchor`. Rejected — browser support and behaviour is inconsistent across the targeted platforms. Manual delta is reliable.

`hasPreviousPage` from `PageInfo` gates whether the observer triggers a fetch, so the observer fires at most once per scroll-to-top while more pages exist.

### Cursor encoding

Cursors are base64-encoded JSON produced by `GraphqlService.findAndPaginate` — no changes needed. The frontend treats them as opaque strings, stores the earliest cursor from `edges[0].cursor` after each prepend.

## Risks / Trade-offs

- **History lost on turn end** — replacing `persistedEvents` with `last: 60` on DONE discards any earlier events the player had loaded. Mitigation: this is intentional and acceptable; the player is at the bottom and focused on new content.
- **First-render flash** — on page load, the transcript shows only the last 60 events. If the player's current position is in earlier history (unusual), they won't see it without scrolling up. Mitigation: 60 events is generous; this edge case is rare.
- **Relaxing `ConnectionArgs` validation** — removing the `CannotUseWithout` on `last` allows any existing connection args type to call with `last` alone. Existing callers are unaffected (they still pass `before`). New callers using `last` alone will get the correct "last N items" behaviour. No risk.

## Migration Plan

1. Modify `ConnectionArgs` — remove `CannotUseWithout(['before'])` from `last`
2. Add `GameEventsConnectionArgs` in `apps/api/src/session/args/`
3. Add `GameEventConnection` / `GameEventEdge` types in `SessionResolver`
4. Update `SessionService.getGameEvents` to accept connection args and delegate to `findAndPaginate`
5. Update `SessionResolver.gameEvents` return type and args
6. Update `GAME_EVENTS_QUERY` in the frontend to the connection shape
7. Refactor `play.vue` event state: initial load, DONE handler, load-earlier with intersection observer
8. No database migration required

Deploy is safe at any point — the app is not in production.

## Open Questions

_(none)_
