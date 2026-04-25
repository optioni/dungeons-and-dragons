## 1. Monorepo Infrastructure

- [ ] 1.1 Create `packages/client/` directory with `package.json` as an unversioned internal workspace package
- [ ] 1.2 Register `packages/client/` in the root workspace `package.json` workspaces array
- [ ] 1.3 Add `graphql-sse` and `graphql` as dependencies in `packages/client/package.json`
- [ ] 1.4 Configure TypeScript (`tsconfig.json`) in `packages/client/` extending the root config
- [ ] 1.5 Create `apps/tui/` directory with `package.json` (Ink, React, TypeScript, `packages/client/` as workspace dep)
- [ ] 1.6 Configure TypeScript and build tooling (tsup or esbuild) in `apps/tui/`
- [ ] 1.7 Add ESLint config to `apps/tui/` extending the root TypeScript config

## 2. Shared Client Package — Core

- [ ] 2.1 Implement `createGraphQLClient(options)` factory in `packages/client/src/client.ts` that returns a configured SSE-capable GraphQL client using `graphql-sse`
- [ ] 2.2 Add exponential backoff reconnection to the SSE client using `graphql-sse`'s `retryAttempts` option and a backoff delay function
- [ ] 2.3 Expose a connection state signal (connected / reconnecting / failed) from the client factory
- [ ] 2.4 Implement token storage utilities in `packages/client/src/auth.ts` with an abstract `TokenStore` interface and concrete implementations for browser (`localStorage`) and Node.js (environment variable / in-memory)
- [ ] 2.5 Wire the token store into the client factory so the JWT is attached to outbound requests via the `Authorization` header

## 3. Shared Client Package — Codegen

- [ ] 3.1 Add `@graphql-codegen/cli` and relevant plugins to `packages/client/package.json`
- [ ] 3.2 Create `codegen.ts` in `packages/client/` pointing at the API schema and all operation files under `apps/web/` and `apps/tui/`
- [ ] 3.3 Run codegen and commit the generated types to `packages/client/src/generated/`
- [ ] 3.4 Export all generated types and operation documents from `packages/client/src/index.ts`

## 4. Migrate Web App to Shared Client

- [ ] 4.1 Update `apps/web/plugins/urql.client.ts` to import `createGraphQLClient` from `packages/client/` instead of constructing its own SSE transport
- [ ] 4.2 Update `apps/web/` to import GraphQL operation types from `packages/client/` instead of local codegen artifacts
- [ ] 4.3 Remove the now-redundant local codegen config and generated files from `apps/web/`
- [ ] 4.4 Run `yarn typecheck` in `apps/web/` and fix any import path errors

## 5. API — Database Migration: sessionType Column

- [ ] 5.1 Add `sessionType` string enum column (`SETUP` | `PLAY`, default `'PLAY'`, not null) to the `GameSession` entity in `apps/api/src/session/entities/game-session.entity.ts`
- [ ] 5.2 Generate MikroORM migration for the `sessionType` column addition
- [ ] 5.3 Verify the migration adds the column with `DEFAULT 'PLAY'` so existing rows are unaffected
- [ ] 5.4 Write a unit test confirming a newly created `GameSession` defaults to `sessionType = PLAY`

## 6. API — Setup Session Type & Registry

- [ ] 6.1 Create `SetupToolRegistrar` in `apps/api/src/llm/setup-tool.registrar.ts` implementing the same registry interface as `GameEngineToolRegistrar`
- [ ] 6.2 Implement `select_story_concept` tool handler — calls `CampaignService.generateCampaignStoryConcepts` and returns a structured result
- [ ] 6.3 Implement `confirm_world_seed` tool handler — calls `CampaignService.generateCampaignWorldSeed` and returns a structured result
- [ ] 6.4 Implement `create_character` tool handler — idempotent draft upsert on the `Character` entity, returns structured result
- [ ] 6.5 Implement `confirm_character` tool handler — locks the draft character, sets `GameSession.sessionType = PLAY`, commits before returning structured result
- [ ] 6.6 Write unit tests for each of the four setup tool handlers (success path + structured failure path)

## 7. API — DmOrchestrator Session Type Branching

- [ ] 7.1 Update `DmOrchestrator` to read `GameSession.sessionType` at the start of each turn
- [ ] 7.2 Load `SetupToolRegistrar` when `sessionType = SETUP`; load `GameEngineToolRegistrar` when `sessionType = PLAY`
- [ ] 7.3 Skip scene module loading entirely when `sessionType = SETUP` (null `sceneType` check)
- [ ] 7.4 Ensure `set_scene_type` is not present in `SetupToolRegistrar` and returns a structured failure if called
- [ ] 7.5 Write unit tests for orchestrator branching: PLAY session loads game engine tools + scene modules; SETUP session loads setup tools + no modules

## 8. API — SETUP Session GraphQL Mutation

- [ ] 8.1 Add a `startSetupSession(campaignId: ID!)` mutation to `SessionResolver` that creates a `GameSession` with `sessionType = SETUP` and `sceneType = null`
- [ ] 8.2 Guard the mutation so only the campaign owner can start a setup session
- [ ] 8.3 Write an integration test for `startSetupSession`: verifies `sessionType = SETUP`, no `sceneType`, and at-most-one-active-session constraint

## 9. TUI — App Scaffold & Auth

- [ ] 9.1 Create the Ink app entry point `apps/tui/src/index.tsx` with a top-level `<App />` component
- [ ] 9.2 Implement a login flow: prompt for email + password, call the `login` mutation via the shared client, store the JWT using the Node.js `TokenStore`
- [ ] 9.3 After successful login, query active campaigns and prompt the user to select or create one
- [ ] 9.4 Detect `process.stdout.columns` on mount and expose a layout context (wide ≥ 120 cols vs. narrow)

## 10. TUI — Play Layout

- [ ] 10.1 Build the two-column play layout: scrolling narrative panel (left) + character sidebar (right) using Ink's `<Box>` flexbox
- [ ] 10.2 Build the single-column degraded layout for terminals narrower than 120 columns
- [ ] 10.3 Implement the narrative panel: append-only buffer capped at a configurable max lines, renders each `GameEvent` in order
- [ ] 10.4 Implement the player input line at the bottom: text input, Enter-to-submit, disabled state during DM turn
- [ ] 10.5 Prevent submission of empty or whitespace-only input
- [ ] 10.6 Implement the character sidebar: HP, AC, level, class, active conditions; refreshes after each DM turn completes

## 11. TUI — DM Stream Subscription

- [ ] 11.1 Subscribe to `dmStream(sessionId)` using the shared SSE client on session start
- [ ] 11.2 Append `NARRATIVE_CHUNK` payloads to the narrative panel in real time
- [ ] 11.3 Lock the input field on stream start; unlock on completion signal
- [ ] 11.4 Handle `SUGGESTED_ACTION` chunks: render numbered options above the input line, selecting one pre-fills the field
- [ ] 11.5 Handle `STATUS` chunks for `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING`: display a status banner
- [ ] 11.6 Show a reconnecting indicator when the SSE connection drops; hide it on successful reconnect
- [ ] 11.7 De-duplicate chunks on reconnect using the session-scoped sequence data from the stream payload

## 12. TUI — Diary / Quest Log View

- [ ] 12.1 Implement a keyboard-toggled diary/quest log view that replaces the narrative panel when open
- [ ] 12.2 Query the last 20 `DiaryEntry` records for the active campaign on view open
- [ ] 12.3 Query active `Quest` records with their `QuestObjective` states on view open
- [ ] 12.4 Render diary entries (oldest-first) and active quests with objective checkboxes
- [ ] 12.5 Pressing the toggle key again dismisses the view and restores the narrative panel

## 13. TUI — ASCII World Map View

- [ ] 13.1 Query discovered `Location` records (filtered by `LocationDiscovery` for the active campaign) including `coordinates` and `connectedLocationIds`
- [ ] 13.2 Implement the ASCII grid renderer: map stored x/y coordinates to an 80 × 24 character canvas
- [ ] 13.3 Render each discovered location as a bracketed label `[Name]`; mark the current location as `[*Name*]`
- [ ] 13.4 Draw ASCII edges (`─`, `│`, diagonal) between connected location pairs
- [ ] 13.5 Implement the keyboard toggle to open/close the map view (replaces narrative panel when open)
- [ ] 13.6 Re-query location and discovery data after a `travel_to` tool result is processed so the map updates in place

## 14. TUI — Setup Flow

- [ ] 14.1 After campaign selection, check `GameSession.sessionType`; if no active session exists, call `startSetupSession` to create a SETUP session
- [ ] 14.2 Subscribe to the SETUP session's `dmStream` and render the DM conversation in the narrative panel
- [ ] 14.3 Accept player input during SETUP using the same input line component as play
- [ ] 14.4 On receiving a `confirm_character` tool result in the stream, transition the TUI to the PLAY layout without requiring a manual restart
- [ ] 14.5 Handle the case where an active PLAY session already exists: skip setup and connect directly to play
