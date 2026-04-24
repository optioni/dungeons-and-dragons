## Context

The `web-game-view` change expands the existing `/campaign/[id]/play` surface into the full gameplay shell described in the proposal. The repo already has the main route in `apps/web/pages/campaign/[id]/play.vue` plus presentation components such as `components/session/CombatPanel.vue`, `CharacterSidebar.vue`, `TranscriptView.vue`, and `CampaignEndScreen.vue`. The design work here is therefore about formalizing how those pieces coordinate around the active session, live `dmStream` chunks, and durable GraphQL state, not inventing a separate frontend architecture.

The main constraint is that the gameplay UI is driven by two different kinds of truth:
- durable state fetched through GraphQL queries and mutations (`campaign`, `activeSession`, `gameEvents`, `character`)
- ephemeral stream chunks from `dmStream(sessionId)` used for in-progress narration, suggested actions, and transient status signals

The view has to feel real-time without letting transient stream state overwrite durable mechanical state. That is especially important for combat layout, level-up flow, spell-preparation flow, campaign-end presentation, and the pending `character-inner-monologue` stream additions (`INNER_VOICE` chunks and an idempotent second `DONE`).

## Goals / Non-Goals

**Goals:**
- Define the play route as the single state coordinator for campaign play UI in `apps/web`
- Keep narrative streaming optimistic while deriving long-lived gameplay state from server-backed queries
- Attach combat, level-up, death, spell-preparation, and character-sidebar UI to explicit stream or session signals instead of narrative parsing
- Preserve a layout that can show sidebar, transcript, and combat information together without route changes
- Make the change spec-friendly by separating modified `game-view-ui` behavior from new focused capabilities such as `combat-ui`, `levelup-ui`, and `death-ui`

**Non-Goals:**
- Introducing new backend APIs, subscription channels, or event types for this change
- Redesigning the overall visual language of the app outside the play route and its immediate session components
- Moving play state into a global store such as Pinia unless later implementation pressure proves the single-route coordinator inadequate
- Solving broader character-sheet, quest-log, or world-navigation UX beyond what the play shell needs during an active session

## Decisions

### 1. Keep the play route as the orchestration boundary

`apps/web/pages/campaign/[id]/play.vue` should remain the container responsible for fetching campaign/session data, subscribing to `dmStream`, reconciling durable state, and passing narrow props into presentational session components.

Rationale:
- The page already owns route params, auth middleware, and the lifecycle for `startSession`
- The combat panel, sidebar, transcript, and overlays all depend on the same session-scoped state and must transition together
- Keeping orchestration in one place avoids introducing a new store layer before the interaction model stabilizes

Alternatives considered:
- Move all play state into a global store: rejected because the route is the only consumer today and store indirection would add ceremony without reducing complexity
- Split each overlay into independent data-fetching components: rejected because stream ordering and shared input-disable rules are cross-cutting concerns

### 2. Use stream chunks only for ephemeral or in-progress UI, then reconcile from queries

The route should continue treating `NARRATIVE_CHUNK`, `SUGGESTED_ACTION`, `INNER_VOICE`, and `STATUS` chunks as short-lived UI inputs while refreshing durable state on `DONE`. Persisted transcript history, character mechanics, scene type, and combat session shape must come from query results or session refetches rather than from accumulated stream assumptions. Because `character-inner-monologue` introduces a second terminal `DONE`, the play shell should treat `DONE` as idempotent once the route is already idle.

Rationale:
- SSE chunks arrive optimistically and can be replayed during reconnects
- Character HP, conditions, spell slots, and combat state are authoritative only after server-side tool execution completes
- This model keeps reconnection behavior simple: re-fetch durable data and drop temporary in-progress state

Alternatives considered:
- Build the full UI directly from streaming payloads: rejected because it would duplicate server state reconstruction logic in the client and increase drift risk
- Refetch after every chunk: rejected because it would create unnecessary network churn and degrade stream responsiveness

### 2a. Keep inner voice as a distinct transcript layer, not as DM narrative

When `INNER_VOICE` chunks are present, the play view should render them as a separate, character-owned transcript treatment beneath or adjacent to the just-completed DM narrative rather than merging them into the main DM prose buffer. This lets `web-game-view` expand the play shell while remaining compatible with the distinct rendering requirement from `character-inner-monologue`.

Rationale:
- Inner monologue is a different speaker and should not be mistaken for DM narration
- Separating the render path avoids corrupting the optimistic DM message assembly logic
- A distinct transcript treatment can coexist with combat, overlays, and sidebar state without altering durable event history semantics

Alternatives considered:
- Append inner voice text into the DM narrative bubble: rejected because it blurs speaker ownership and complicates transcript reconciliation
- Ignore inner voice in `web-game-view` artifacts and retrofit later: rejected because the play route contract is already changing and the specs should describe the intended steady state

### 3. Drive scene-specific layout from `GameSession.sceneType` plus typed session payloads

Combat presentation should be gated by durable session state: show the `CombatPanel` only when `sceneType === "COMBAT"` and a `combatSession` payload exists. Entering or leaving combat is therefore a shell-layout transition, not a transcript-side effect. The same principle applies to any future death-specific or pause-state UI: use explicit session/status signals, never narrative keyword matching.

Rationale:
- The existing `game-view-ui` spec already defines `sceneType` as the durable layout driver
- Combat layout changes affect the whole shell, so they should be based on a single authoritative field
- Typed payload requirements make future testing easier than string-inspection heuristics

Alternatives considered:
- Infer combat from tool-result text or narration wording: rejected because it is brittle and impossible to make deterministic
- Always reserve space for combat UI: rejected because it harms the narrative-first layout outside combat

### 4. Model level-up, spell-preparation, death, and campaign-end as blocking overlays or mode switches

Pending flows that require immediate player resolution should freeze the normal text input and surface dedicated UI on top of the narrative column. `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING` already follow this pattern. Death-saving-throw UI should follow the same blocking-flow model when the active character reaches the qualifying state. `CAMPAIGN_ENDED` remains a full-screen mode switch because normal play controls are no longer valid.

Rationale:
- These flows are mutually exclusive with freeform play input
- The user needs focused controls and validation for structured decisions such as ASI distribution or spell preparation
- Consistent blocking semantics simplify the disabled-state rules for the main input

Alternatives considered:
- Render these flows inline in the transcript: rejected because the player input box would still be visible and the route would have ambiguous submission behavior
- Navigate to dedicated subroutes: rejected because the flow is tightly coupled to the active session stream and should resume in place

### 5. Keep session components presentation-focused with typed props and emitted intents

`CombatPanel`, `CharacterSidebar`, `TranscriptView`, and future death or level-up components should remain UI-focused. They receive typed data from the play route and emit user intents such as quick-action prefills or submit actions; they do not own fetching, mutation orchestration, or subscription logic.

Rationale:
- It preserves testability through component-level props and event assertions
- Shared disabled-state and reconciliation rules stay centralized
- The route can swap data sources or refetch timing without rewriting display components

Alternatives considered:
- Let components call GraphQL operations directly: rejected because it scatters play-session coordination across the tree

## Risks / Trade-offs

- [Single route owns many concerns] -> Mitigation: keep orchestration logic grouped by domain within `play.vue`, and extract only presentational subcomponents or narrow composables when repeated patterns become obvious
- [Ephemeral and durable state can drift after reconnects or failed mutations] -> Mitigation: continue sequence-based chunk deduplication, clear temporary state on `DONE`, ignore duplicate terminal `DONE` chunks when already idle, and refetch session/events/character after state-changing flows
- [Inner monologue may race with shell updates because it arrives after the main turn completes] -> Mitigation: treat transcript streaming and shell state reconciliation as separate concerns so post-turn `INNER_VOICE` rendering does not retrigger combat/layout transitions
- [Blocking overlays can conflict if multiple statuses arrive in one stream] -> Mitigation: define precedence rules in implementation and specs so only one blocking UI is actionable at a time
- [Death UI requirements may overlap with combat and campaign-end states] -> Mitigation: treat death saves as a distinct session mode with explicit precedence below campaign end and above freeform input
- [The current route file may become hard to maintain] -> Mitigation: extract focused composables for stream handling or overlay state only after the spec stabilizes, not before

## Migration Plan

1. Finalize delta specs for the modified `game-view-ui` capability and the new focused UI capabilities (`combat-ui`, `levelup-ui`, `death-ui`), explicitly accounting for `character-inner-monologue` stream behavior where the play route contract overlaps.
2. Align the existing `apps/web/pages/campaign/[id]/play.vue` behavior with those specs, using the route as the orchestration layer and the session components as presentational units.
3. Add or update component and route tests in `apps/web/tests` to lock the stream-driven transitions, input-disable behavior, and combat/death/overlay visibility rules.
4. Roll out as a frontend-only change with no backend migration requirement.
5. If regressions appear, rollback is a standard web deploy rollback because no schema or persisted data contract changes are required by this design.

## Open Questions

- Should death-saving-throw UI be driven solely from durable character state (`hp === 0` plus death-save counters) or from an explicit stream/session flag similar to level-up and spell prep?
- If multiple blocking statuses are possible in the same turn, what is the exact precedence order between level-up, spell preparation, death saves, and campaign end?
- Does the level-up overlay need to handle class-specific choices beyond ASI/feat and HP gain in this change, or is that deferred to a later capability?
- Should `web-game-view` reference `INNER_VOICE` directly in the modified `game-view-ui` delta spec, or should that transcript-rendering behavior live only in the dedicated `character-inner-monologue` capability while `web-game-view` merely stays compatible with it?
