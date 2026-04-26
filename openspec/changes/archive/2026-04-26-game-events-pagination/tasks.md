## 1. Shared Infrastructure

- [x] 1.1 Remove `@Validate(CannotUseWithout, ['before'])` from the `last` field in `apps/api/src/graphql/relay/connection-args.ts`
- [x] 1.2 Verify existing paginated queries (campaigns, world events, etc.) still pass typecheck after the ConnectionArgs change

## 2. API — Session Module

- [x] 2.1 Create `GameEventConnection` and `GameEventEdge` ObjectTypes in `apps/api/src/session/session.resolver.ts` using `createRelayConnection(GameEvent)`
- [x] 2.2 Create `apps/api/src/session/args/game-events-connection.args.ts` extending `ConnectionArgs` with a required `sessionId: ID!` field
- [x] 2.3 Update `SessionService.getGameEvents` to accept `ConnectionArgs` and delegate to `GraphqlService.findAndPaginate` with default `last: 60`
- [x] 2.4 Update `SessionResolver.gameEvents` return type to `GameEventConnection`, swap args to `GameEventsConnectionArgs`, inject `GraphqlService`
- [x] 2.5 Run `cd apps/api && yarn typecheck` — confirm no errors

## 3. Frontend — GraphQL Query

- [x] 3.1 Update `GAME_EVENTS_QUERY` in `apps/web/graphql/session.ts` to the connection shape: select `edges { cursor node { id sessionId eventType content createdAt } }` and `pageInfo { hasPreviousPage startCursor }`
- [x] 3.2 Update the `PersistedGameEvent` type in `play.vue` to derive from the new connection edge node shape

## 4. Frontend — Event State Management

- [x] 4.1 Store `earliestCursor` ref (the `startCursor` from the last `pageInfo` received)
- [x] 4.2 On `sessionId` mount: fetch `gameEvents(last: 60)`, populate `persistedEvents` from `edges[].node`, store `earliestCursor` from `pageInfo.startCursor`, store `hasPreviousPage` from `pageInfo`
- [x] 4.3 Update DONE handler: refetch `gameEvents(last: 60)` (no cursor), replace `persistedEvents`, reset `earliestCursor` and `hasPreviousPage` from fresh `pageInfo`

## 5. Frontend — Load Earlier

- [x] 5.1 Add a sentinel `<div ref="topSentinelRef">` at the very top of the transcript scroll area in `play.vue`
- [x] 5.2 Set up an `IntersectionObserver` on `topSentinelRef` that fires when the sentinel enters the viewport
- [x] 5.3 When the observer fires and `hasPreviousPage` is true and no load is in progress: fetch `gameEvents(last: 60, before: earliestCursor)`
- [x] 5.4 On successful earlier-page fetch: capture `scrollEl.scrollHeight` before mutating, prepend new `edges[].node` events to `persistedEvents`, update `earliestCursor` and `hasPreviousPage`, then in `nextTick` add the `scrollHeight` delta to `scrollEl.scrollTop`
- [x] 5.5 Guard the observer with an `isLoadingEarlier` ref so concurrent fetches cannot be triggered

## 6. Verification

- [x] 6.1 Run `cd apps/api && yarn typecheck` — no errors
- [x] 6.2 Run `cd apps/web && yarn typecheck` — no errors
- [x] 6.3 Manual smoke test: open play route, confirm only recent events load, scroll to top, confirm earlier events load without scroll jump
- [x] 6.4 Manual smoke test: send a player turn, confirm DONE handler replaces the window with fresh events and auto-scrolls to bottom
- [x] 6.5 Manual smoke test: session with fewer than 60 total events — confirm `hasPreviousPage` is false and no load-earlier trigger fires
