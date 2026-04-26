## Context

`InnerMonologueService` generates 2-3 sentences of the character's internal thought after each eligible DM turn and publishes the text as `INNER_VOICE` SSE chunks. The frontend accumulates these into `innerVoiceText` (a plain `ref`) and clears it when the player sends their next input. Nothing is persisted — a page reload loses the monologue entirely.

The fix is minimal: store the latest monologue on `GameSession` and read it back on page load. Only the current turn's monologue matters; past monologues are not shown and do not need to be retained.

## Goals / Non-Goals

**Goals:**
- Inner monologue survives a page reload for the current pending turn
- No extra query on page load — value comes from the already-fetched `activeSession`

**Non-Goals:**
- Surfacing inner monologue history in the transcript
- Storing per-turn monologues permanently
- Changing any streaming behaviour

## Decisions

### Store on `GameSession` as `lastInnerVoice: string | null`

The monologue is transient session state — it exists only while awaiting the player's next response. A nullable column on `GameSession` is the exact right primitive: it lives and dies with the turn, is cleared atomically when input arrives, and is returned for free in the `activeSession` query the frontend already makes on mount.

Alternatives considered:
- **`EventType.INNER_VOICE` GameEvent row** — append-only log rows are permanent; we'd need frontend logic to find the latest one and decide whether it's still current (i.e., no `PLAYER_INPUT` since). More moving parts, no benefit for this use case.
- **Embed in `DM_NARRATIVE` content jsonb** — would require mutating an already-written `GameEvent` row, which violates the append-only design of the event log.

### Write after SSE publish, clear on player input arrival

`InnerMonologueService.runIfApplicable` already holds a reference to the loaded `GameSession` entity. After the text is assembled and published to SSE, write `session.lastInnerVoice = text` and flush. This is a fire-and-forget write inside the existing try/catch block — a flush failure logs and is swallowed the same way an SSE publish failure would be.

Clearing happens in `SessionResolver.sendPlayerInput`, immediately after the session is loaded and validated, before `dmOrchestrator.runTurn` is called. This is the earliest safe moment: the session record is in hand and the new turn has not started.

### Frontend reads from `activeSession` on mount

`play.vue` already fetches `activeSession` when `sessionId` is set (via `refetchActiveSession`). Adding `lastInnerVoice` to the `GameSession` GraphQL type and to the `ACTIVE_SESSION_QUERY` fragment means the restore happens with zero additional network calls. The existing streaming path is untouched — SSE still populates `innerVoiceText` in real time; the DB value is only the reload fallback.

## Risks / Trade-offs

- **Stale monologue on hard reload during streaming** — if the page reloads mid-stream before the inner monologue text is written, `lastInnerVoice` will be null and nothing is shown. Acceptable; the incomplete state was already lost.
- **Flush after SSE publish adds a DB round-trip to the monologue path** — the monologue Haiku call is already async and fire-and-forget from the player's perspective, so this has no visible latency impact.

## Migration Plan

1. Add `lastInnerVoice text DEFAULT NULL` column to `game_session` table via a MikroORM migration
2. No backfill needed — null is the correct value for all existing sessions
3. Deploy API, then frontend — both are backwards-compatible (new nullable field, no removals)

## Open Questions

_(none)_
