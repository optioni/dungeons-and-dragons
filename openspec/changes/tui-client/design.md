## Context

The app currently has a single Nuxt 3 web client. All gameplay — setup, narrative, combat, inventory — flows through GraphQL mutations/queries and SSE subscriptions served by the NestJS API. The text-first nature of the game (streaming DM narrative, player typed input, structured combat state) is a natural fit for a TUI, and a conversational setup flow (DM drives campaign + character creation via tool calls) is a better experience than the current form-based mutations.

The change adds three independent concerns:
1. A new `apps/tui/` Ink app as a parallel client
2. A `packages/client/` shared package to avoid duplicating GraphQL/SSE plumbing between web and TUI
3. A `SETUP` session type backed by a new `SetupToolRegistrar` so the DM can build the campaign and character conversationally before `PLAY` begins

The API remains backwards-compatible — web continues to work unchanged.

## Goals / Non-Goals

**Goals:**
- Full feature parity between TUI and web: narrative panel, character sidebar, combat tracker, ASCII world map, diary/quest log, setup flow
- Conversational setup: DM drives campaign concept selection, world seed generation, and character creation via tool calls in a `SETUP` session; client just shows the stream
- `packages/client/` shares the SSE subscription logic, generated GraphQL types, and auth token management between web and TUI — no duplication
- Zero API breaking changes; existing web mutations/queries remain intact

**Non-Goals:**
- Replacing the web app — TUI is an additive client
- Rich graphics or mouse interaction — keyboard-driven terminal UI only
- Multi-player or networked TUI sessions
- Migrating existing campaigns created before this change through the setup flow

## Decisions

### Ink (React + TypeScript) for the TUI
Ink renders React components to the terminal using Yoga layout. It gives component composition, hooks, and the same mental model as the web app rather than a raw ncurses-style library. The TUI is text-heavy with structured panels (narrative scroll, sidebar stats, input line) — Ink's flexbox layout handles this cleanly. Alternative: `blessed` — more battle-tested but no TypeScript-first story and no React model.

### `packages/client/` as a shared workspace package
Both web and TUI need: GraphQL SSE subscription handling, generated types (codegen), and auth token storage. Extracting these into `packages/client/` avoids copy-paste divergence and keeps the codegen config in one place. The web app's urql plugin already wraps the SSE client — after this change it imports the shared factory instead of its own. Alternative: duplicate in each app — rejected because codegen drift is a maintenance hazard.

### `SessionType` enum on `GameSession` (`SETUP` | `PLAY`)
A single `sessionType` field on `GameSession` gates which tool registry the `DmOrchestrator` loads and whether the session has a scene type / prompt modules. This is the minimal delta to the data model — no new entity, no migration beyond adding the column with a default of `PLAY` for existing rows. Alternative: a separate `SetupSession` entity — over-engineered; the difference is tool registry selection and the absence of a scene type, not a fundamentally different entity shape.

### `SetupToolRegistrar` with 4 tools, no scene type or prompt modules
The SETUP session intentionally has no `sceneType` and skips the dynamic prompt module system. The DM's job is to collaborate with the player on world and character — injecting combat/exploration modules would add noise. The 4 tools (`select_story_concept`, `confirm_world_seed`, `create_character`, `confirm_character`) cover the full setup arc. `create_character` is idempotent during SETUP — calling it again replaces the draft. `confirm_character` locks the character and transitions `sessionType` to `PLAY`. Alternative: reuse `GameEngineToolRegistrar` with a setup flag — rejected because the tool sets are disjoint and mixing them risks the DM calling play-phase tools before the world exists.

### Campaign generation called internally by setup tool handlers
`generateCampaignStoryConcepts` and `generateCampaignWorldSeed` currently exist as standalone service methods called by GraphQL mutations. In the setup flow the DM calls `select_story_concept` and `confirm_world_seed` — the handlers call these same service methods. No new service logic needed; the GraphQL mutations remain for web but are no longer the only path. Alternative: new dedicated service methods — unnecessary since the existing ones are already side-effect-free and well-tested.

### ASCII world map in TUI using `Location.coordinates` and `connectedLocationIds`
Locations already have `x/y` coordinates and a `connectedLocationIds` array. The TUI renders them as labeled nodes (e.g. `[Town]`) connected by ASCII edges (`─`, `│`, `┼`), filtered by `LocationDiscovery` to show only discovered locations. This is a pure render concern — no API changes required. Alternative: a graph-layout algorithm — unnecessary; the stored coordinates are sufficient for a fixed-size terminal canvas.

## Risks / Trade-offs

- **SSE keep-alive in Node (TUI)** — Browser SSE is native; in Node the `graphql-sse` client needs explicit reconnect handling. The shared client package must implement exponential backoff so the TUI doesn't silently drop the stream. → Use `graphql-sse`'s `createClient` with `retryAttempts` and surface reconnect state in the UI.
- **Ink re-render performance with long narrative** — Ink re-renders the full tree on each streamed token. The narrative panel must virtualize or truncate old scroll content to avoid sluggish rendering on long sessions. → Cap the visible narrative buffer at N lines and append-only; full history accessible via a separate diary view.
- **`confirm_character` transition race** — If the client sends a second message while `confirm_character` is executing, the session type might not have flipped yet. → `confirm_character` handler must set `sessionType = PLAY` and commit before returning a tool result to the LLM; the orchestrator re-reads `sessionType` at the start of each turn.
- **Codegen in `packages/client/` requires both apps to agree on the schema** — Any schema change requires re-running codegen in the shared package and releasing before web or TUI can use new fields. → Add codegen to the CI pipeline and treat the generated types as a build artifact, not a committed file.
- **Terminal width variability** — The ASCII map and sidebar layout assume a minimum terminal width (~120 cols). Narrower terminals degrade gracefully by hiding the sidebar and collapsing the map. → Detect `process.stdout.columns` on mount and render a single-column layout below the threshold.

## Migration Plan

1. Add `sessionType` column to `game_sessions` table — migration with `DEFAULT 'PLAY'`; all existing rows remain `PLAY` sessions unaffected.
2. Add `packages/client/` workspace; migrate `apps/web/` urql plugin to import from it; run codegen.
3. Implement `SetupToolRegistrar` and wire `DmOrchestrator` to branch on `sessionType`.
4. Build `apps/tui/` against the shared client package; verify end-to-end setup → play flow locally.
5. No rollback complexity — `sessionType` column has a safe default; the shared client package is additive.

## Open Questions

- Should the SETUP session have a message history cap, or is it always short enough that the full conversation fits in one context window without truncation?
- Does `confirm_character` need to emit a `GameEvent` (e.g. `CHARACTER_CONFIRMED`) that the web app can listen to, or is a polling/query approach sufficient for web clients monitoring a shared campaign?
- Will `packages/client/` use a separate `package.json` with its own versioning, or is it an unversioned internal workspace package only?
