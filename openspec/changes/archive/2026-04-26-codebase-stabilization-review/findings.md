# Codebase Stabilization Review Findings

Review date: 2026-04-24

## Playability Verdict

| Field | Value |
| --- | --- |
| Verdict | not ready |
| Summary | The backend and play route contain most of the core loop, but normal dashboard navigation sends ready campaigns back to setup/dashboard instead of the play route. Verification is also red across lint, typecheck, unit tests, web tests, and integration environment startup. |
| Blocking Findings | F-001, F-002, F-003 |
| Caveats | Manual navigation to `/campaign/:id/play` appears to load/start sessions, but this is not the normal player path. LLM-dependent flows were traced statically and by tests; no live Claude turn was run. |
| Evidence Reviewed | Baseline commands, core API resolvers/services, web campaign/setup/play/world routes, GraphQL operations, active OpenSpec specs, API/web tests. |

Minimum ready-to-play criteria:

| Criterion | Result | Evidence | Finding |
| --- | --- | --- | --- |
| User can register or log in | implemented, tests pass | `apps/api/src/auth/auth.resolver.ts`; `apps/web/pages/auth.vue`; focused API auth/session slice passed. | none |
| Campaign can be created and opened | implemented with navigation bug after ready | `apps/web/pages/index.vue:205-224` creates and opens setup; `apps/api/src/campaign/campaign.resolver.ts`. | F-001 |
| Character can be created or selected | implemented, LLM fallback present | `apps/web/pages/campaign/[id]/setup.vue:654-689`; `apps/api/src/character/character.service.ts:133-185`. | none |
| Play screen loads with campaign and character context | implemented if reached directly | `apps/web/pages/campaign/[id]/play.vue:431-511` loads campaign, active session, or starts one. | F-001 |
| Player input produces a streamed DM response | implemented, not live-verified | `apps/api/src/session/session.resolver.ts:77-100`; `apps/api/src/session/dm-orchestrator.service.ts:130-189`; `apps/web/pages/campaign/[id]/play.vue:538-620`. | F-006 |
| LLM tool calls update game state without crashing the stream | mostly implemented | `apps/api/src/llm/tool-registry.service.ts:19-38`; `apps/api/src/game-engine/game-engine-tool-registrar.service.ts`. | F-002, F-006 |
| Combat/check/rest/level-up/spell-prep flows do not dead-end the player | partial, unit import failures hide several suites | `apps/web/tests/play.spec.ts`; `apps/api/src/game-engine/*.spec.ts`; root `yarn test` fails four game-engine suites. | F-003 |
| Long rest and world tick works or fails gracefully | partial, integration not executable here | `apps/api/src/game-engine/game-engine-tool-registrar.service.ts:262-283`; `apps/api/src/world/world-tick.worker.ts:97-111`. | F-004, F-005 |
| Character, quest, diary/memory, and world state remain inspectable after play | partial | Character/quests/world routes exist; diary load-more is a placeholder. | F-007 |
| Verification has no unexplained blocker undermining the core loop | failed | Baseline commands below. | F-002, F-003, F-004, F-005 |

## Baseline Results

| Command | Result | Evidence | Blocking? | Notes |
| --- | --- | --- | --- | --- |
| `yarn lint` | fail | API lint exits 1 with 92 errors, mostly naming-convention in `context-loader.service.spec.ts`, `inner-monologue.service.spec.ts`, `test-global-setup.ts`, plus `inner-monologue.service.ts:125`. | yes | Quick maintenance fix. |
| `yarn typecheck` | fail | API `tsc --noEmit` exits 2: `GameEngineToolRegistrar` expected 24 constructor args but specs pass 16 at `game-engine-tool-registrar.spec.ts:57,185,296,423,621` and `memory-tools.spec.ts:106`. | yes | Tests are stale after dependency expansion. |
| `yarn test` | fail | API unit run: 35 files / 315 tests pass; 4 suites fail to import because `@nestjs/common` mocks omit `Optional`, used by `DiceService`. | yes | `combat.service.spec.ts`, `travel.service.spec.ts`, `dice-checks.service.spec.ts`, `dungeon-navigation.handlers.spec.ts`. |
| `yarn workspace api test:integration` | blocked | Global setup throws: Docker/Testcontainers runtime unavailable for `pgvector/pgvector:pg17` and `redis:7-alpine`. | env blocker | Not a product failure by itself, but local verification is blocked. |
| `openspec list --json` | pass | Lists active changes: `codebase-stabilization-review`, `ssh-tui-server`, `tui-client`. | no | Stabilization change is in progress. |
| `openspec validate --all --strict` | fail | 69 passed, 2 failed: `change/ssh-tui-server`, `change/tui-client`; stabilization change and all main specs pass. | no | Unrelated active no-task changes keep global validation red. |

Additional verification:

| Command | Result | Evidence | Notes |
| --- | --- | --- | --- |
| `yarn workspace web typecheck` | pass | Exited 0. | Root typecheck never reaches this because API fails first. |
| `yarn workspace web test` | fail | 4 files / 42 tests pass; `tests/CombatPanel.spec.ts` fails import resolution for `../introspect` from `apps/web/graphql/tada.ts:3`. | Quick fix. |
| Focused API slice | pass | `auth.resolver.spec.ts`, `dm-orchestrator.service.spec.ts`, `session.service.spec.ts`, `world-tick.worker.spec.ts`, `quest.service.spec.ts`, `memory.service.spec.ts`: 6 files / 82 tests pass. | Confirms several core services are not globally broken. |

## Critical User Journeys

| Journey | Entrypoints | Happy Path | Failure Path | Tests Found | Result |
| --- | --- | --- | --- | --- | --- |
| User registration/login/session auth | `AuthResolver.register/login`; `pages/auth.vue`; global `AuthGuard` | Public auth mutations set `access_token` cookie and return token. | Invalid credentials and password mismatch handled. | Auth unit/integration specs; focused auth test passed. | implemented |
| Campaign creation and campaign list/detail access | `CampaignResolver.createCampaign/campaigns/campaign`; `pages/index.vue` | Draft campaign creation navigates to setup. Relay list query exists. | Load/create errors are displayed. | Campaign service/integration specs present. | partial: ready campaign play navigation is wrong (F-001) |
| Character creation and character sheet visibility | `CharacterResolver.createCharacter`; `pages/campaign/[id]/setup.vue`; `pages/campaign/[id]/character.vue` | Standard array/race/class flow creates character and sheet route can resolve by campaign or `characterId`. | Form and API errors are displayed; personality generation falls back. | Character specs and page tests present indirectly; focused root tests blocked by unrelated issues. | implemented, verification red globally |
| Main play session route and `dmStream` lifecycle | `SessionResolver.startSession/sendPlayerInput/dmStream`; `pages/campaign/[id]/play.vue` | Direct play route starts/resumes active session, subscribes, accumulates chunks, refetches on `DONE`. | Non-owner subscription rejected; blank/ended input rejected. | API session/orchestrator specs; web play specs. | partial: route exists but normal dashboard path does not reach it (F-001) |
| LLM tool calls and structured tool error handling | `ToolRegistry.dispatch`; `GameEngineToolRegistrar` | Registry catches handler exceptions and returns structured `ToolResult`. | Unknown tool and handler exceptions return structured failures. | `tool-registry.service.spec.ts`, orchestrator specs. | implemented, but constructor test drift blocks typecheck (F-002) |
| Combat/check/rest/level-up/spell-prep mechanics | Game engine services/tools; play overlays | Services and UI controls exist for combat, dice/checks, rests, level-up, spell prep. | Several game-engine test files fail before assertions due mocks. | Many specs exist, but root import failures hide coverage. | partial (F-003) |
| Long rest and world tick queue behavior | `take_long_rest` tool; `WorldTickWorker`; `QueueModule` | Rest writes diary synchronously; worker has Redis lock and sequential tick pipeline. | Worker logs and returns skipped/not-found; Testcontainers blocked locally. | World tick unit/integration specs present; integration blocked. | partial (F-004, F-005) |
| Quest auto-checking and quest UI state | `QuestService.runAutoChecker`; `QuestResolver`; `pages/campaign/[id]/quests.vue` | State-changing tools call auto-checker in representative paths and quest UI lists active/completed. | Quest resolver owner checks. | Quest service/integration specs present; focused quest test passed. | implemented |
| Diary entries, memory facts, and context replay | `MemoryResolver`; `MemoryService`; `ContextLoader`; world page | Diary entries feed prompt context; memory tools are registered; world page shows recent diary. | Embedding failures do not block persistence. | Memory service/integration specs; focused memory test passed. | partial: diary pagination UI is placeholder (F-007) |
| World overview data: factions, NPCs, events, locations | `WorldResolver`; `pages/campaign/[id]/world.vue`; `graphql/world.ts` | Factions, NPCs, active events, map, and NPC profile queries exist. | Empty/load/error states present for major panels; travel mutation errors shown. | `world.spec.ts`, `WorldMapGraph.spec.ts`. | implemented with diary pagination gap (F-007) |

## Spec to Code Alignment

| Capability | Spec Path | Code Evidence | Test Evidence | State | Finding |
| --- | --- | --- | --- | --- | --- |
| api-graphql | `openspec/specs/api-graphql/spec.md` | Campaign character lookup, diary relay, world queries, NPC profile exist in resolvers/graphql ops. | Integration specs present but blocked by Docker locally. | unverified | F-005 |
| character-creation | `openspec/specs/character-creation/spec.md` | `CharacterService.create` populates personality and falls back on failure. | Character service/integration specs present. | implemented | none |
| character-sheet-page | `openspec/specs/character-sheet-page/spec.md` | `pages/campaign/[id]/character.vue` renders stats, saves, skills, spells, inventory, nav. | No direct component test found. | unverified | F-008 |
| game-session | `openspec/specs/game-session/spec.md` | `SessionService`, `SessionResolver`, append-only events, active session logic. | Focused session tests passed. | implemented | none |
| game-view-ui | `openspec/specs/game-view-ui/spec.md` | Play route implements stream chunks, blocking overlays, combat panel, sidebar. | Web play tests exist; root route to play is broken. | partial | F-001 |
| llm-orchestration | `openspec/specs/llm-orchestration/spec.md` | `DmOrchestrator`, `ContextLoader`, prompt modules, registry contract. | Focused orchestrator tests passed. | implemented | none |
| game-engine | `openspec/specs/game-engine/spec.md` | Registrar injects `QuestService` and stream side-effect handlers. | Typecheck stale constructor specs; some unit suites fail import. | partial | F-002, F-003 |
| world-tick | `openspec/specs/world-tick/spec.md` | Redis lock and tick pipeline exist. | Unit worker tests pass in focused slice; integration blocked. | unverified | F-005 |
| npc-agendas | `openspec/specs/npc-agendas/spec.md` | Worker evaluates due NPCs, conversations, movement outcomes. | World tick worker tests present. | implemented | none |
| diary-system | `openspec/specs/diary-system/spec.md` | Long rest writes diary; memorial diary path exists; recent diary context loads. | Focused memory/world tests pass; integration blocked. | implemented | none |
| memory-facts | `openspec/specs/memory-facts/spec.md` | Memory entity/service/tools exist and structured errors are returned. | Focused memory test passed. | implemented | none |
| quest-auto-checker | `openspec/specs/quest-auto-checker/spec.md` | Auto-checker called after travel/damage/item/world changes. | Focused quest test passed. | implemented | none |
| world-overview-page | `openspec/specs/world-overview-page/spec.md` | World page shows map, factions, NPCs, diary, active events. | Web world tests pass; diary load-more not implemented. | partial | F-007 |
| integration-test-infrastructure | `openspec/specs/integration-test-infrastructure/spec.md` | Testcontainers global setup exists. | Blocked by missing Docker; setup omits latest migration. | partial | F-004, F-005 |

## API Architecture

| Check | Evidence | Result | Finding |
| --- | --- | --- | --- |
| Resolver guard coverage | `GraphqlModule` registers `APP_GUARD`; `AuthResolver` uses `@Public`; owner-scoped resolvers use `@CurrentUser`. | no issue found | none |
| Relay pagination consistency | Campaign, quest, world, diary, SRD list queries use `ConnectionArgs`/connection types. `gameEvents` remains non-relay transcript query, which matches session resume usage. | no issue found | none |
| Service boundaries and transactions | `QuestService.createQuest` wraps quest scaffolding in `em.transactional`; setup/character/session logic remains service-owned. | no immediate issue | none |
| Entity relationships and migrations | Migration file `Migration20260424000000.ts` exists but `test-global-setup.ts` migration list stops at `Migration20260423000000`. | stale test harness migration state | F-004 |
| Config-driven LLM model usage | Runtime services read `LLM_DM_MODEL` / `LLM_BACKGROUND_MODEL`; hardcoded Claude strings found only in tests. | no runtime issue found | none |
| Structured LLM tool errors | `ToolRegistry.dispatch` catches unknown tools and handler throws into structured results. Many handlers return `{ success: false, errorCode, message }`. | no issue found | none |
| Prompt caching and context growth | `DmOrchestrator` marks base/campaign/world/history breakpoints; `ContextLoader` replays full session history, so long sessions can still grow. | acceptable caveat | no action |
| Queue locking and world tick safety | `WorldTickWorker.process` uses Redis `SET ... NX EX` and releases in `finally`; registrar checks `campaignLocked` before permadeath ending. | no issue found | none |

## Web Architecture

| Check | Evidence | Result | Finding |
| --- | --- | --- | --- |
| Campaign route coverage | Dashboard lists campaigns and setup route exists. Ready Play button routes to setup instead of play. | core navigation bug | F-001 |
| Character/world/play route coverage | Character, quests, world, play pages exist and link back to play; play sidebar lacks world link but other pages include it. | mostly implemented | F-001 |
| GraphQL operation coverage | `apps/web/graphql/session.ts`, `world.ts`, `quests.ts`, `character.ts` cover core pages. | no issue found | none |
| Stream chunk state handling | `play.vue` deduplicates by sequence, handles second `DONE`, keeps inner voice separate, refetches on completion. | no issue found | none |
| Loading/empty/error states | Major pages have loading/empty/error states; play route redirects on missing campaign but has no explicit session-start error state. | minor gap | F-008 |
| Campaign navigation | Setup completion returns to dashboard; dashboard Play returns to setup. | core navigation bug | F-001 |
| Mobile/desktop layout risks | Play route uses fixed `h-screen`, fixed 14rem sidebar, and left combat panel; no responsive tests/screenshots found. | unverified | F-008 |

## Testing Quality

| Feature Area | Unit Coverage | Integration Coverage | Frontend Coverage | Result | Finding |
| --- | --- | --- | --- | --- | --- |
| Auth | API unit specs pass in focused slice | `auth.integration.spec.ts` present, blocked locally | Auth page has no component test | acceptable | none |
| Campaigns | API service/setup specs present | `campaign.integration.spec.ts` present, blocked locally | Dashboard/setup page tests absent | partial | F-001, F-008 |
| Characters | API service specs present | `character.integration.spec.ts` present, blocked locally | Character sheet page tests absent | partial | F-008 |
| Sessions and stream | API session/orchestrator specs pass in focused slice | `session.integration.spec.ts` present, blocked locally | Play tests exist and mostly pass when import issue is not involved | partial | F-006 |
| Game engine tools | Broad API unit coverage exists | Integration coverage present for some DB-backed flows | Combat panel tests exist but import failure stops one file | failing | F-002, F-003 |
| World tick and NPC agendas | Worker unit tests pass in focused slice | `world-tick.integration.spec.ts` blocked locally | no frontend need | partial | F-004, F-005 |
| Quests | API quest specs pass in focused slice | `quest.integration.spec.ts` blocked locally | Quests page test absent | partial | F-008 |
| Diary and memory | API memory specs pass in focused slice | `memory.integration.spec.ts` blocked locally | World page tests cover some diary/world behavior, not load-more | partial | F-007 |
| World overview | API world specs present | world-related integration blocked locally | `world.spec.ts`, `WorldMapGraph.spec.ts` pass in web run | partial | F-007 |
| Testcontainers harness | Global setup exists | blocked without Docker; migration list stale | n/a | partial | F-004, F-005 |

## Ranked Findings

| ID | Severity | Area | Follow-up Type | Evidence | Impact | Suggested Action |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | P1 Correctness Bug | Web campaign navigation | quick fix | `apps/web/pages/index.vue:235-238` routes ready campaign Play to `/setup`; `apps/web/pages/campaign/[id]/setup.vue:28-31` sends ready campaigns to dashboard. | A normal player cannot enter the play route from the app after setup, so the game is not ready to play. | Route ready campaign Play and setup completion CTA to `/campaign/${id}/play`; add a page test for this path. |
| F-002 | P1 Correctness Bug | API typecheck | quick fix | `yarn typecheck` fails because `GameEngineToolRegistrar` specs instantiate 16 args while constructor has 24 at `game-engine-tool-registrar.service.ts:52-77`. | Typecheck is red and stale tests can hide real contract drift. | Update registrar test factories and `memory-tools.spec.ts` constructor calls for new dependencies. |
| F-003 | P1 Correctness Bug | API unit tests | quick fix | `yarn test` fails four suites because `@nestjs/common` mocks omit `Optional`, while `DiceService` imports `Optional` at `dice.service.ts:1,51`. | Core game-engine test suites do not run, weakening combat/check/travel confidence. | Add `Optional` to shared mocks or stop mocking the whole module. |
| F-004 | P1 Correctness Bug | Integration harness | quick fix | `Migration20260424000000.ts` exists, but `test-global-setup.ts:46-63` omits it from `MIGRATIONS`. | Integration DB setup can be stale even when Docker is available, especially for world map scale behavior. | Add the migration to global setup and add a guard test that migrations list includes all source migrations. |
| F-005 | P3 Test Gap | Integration verification | defer | `yarn workspace api test:integration` blocked: no working Docker/Testcontainers runtime. | DB/Redis-backed core loop cannot be verified in this environment. | Re-run on a machine/CI runner with Docker; keep as environment caveat, not product failure. |
| F-006 | P3 Test Gap | LLM/live stream | new OpenSpec change | No live Claude-backed play smoke test was run; existing tests mock orchestration. | The most important player-facing loop is only statically and unit verified. | Add a follow-up verification change for a deterministic smoke harness or documented manual smoke script with fake Anthropic transport. |
| F-007 | P2 Spec Drift | World overview diary pagination | quick fix | Spec requires older diary entries; `world.vue:756-760` has a placeholder and never uses `after`. | Players cannot load older diary entries from the world overview despite API support. | Implement cursor-based diary load-more and extend `world.spec.ts`. |
| F-008 | P3 Test Gap | Web route/page coverage | new OpenSpec change | No direct page tests for dashboard ready Play, setup completion, character sheet, quests page, or responsive play layout; web tests fail one import suite. | User journeys can regress without failing tests. | Add focused web route tests for core navigation and inspectable state pages. |
| F-009 | P4 Cleanup | Lint hygiene | quick fix | `yarn lint` reports 92 API lint errors, mostly fixture object key naming and generated/test env keys. | No behavior impact, but blocks clean baseline and future CI. | Add scoped eslint disables for external schema keys or normalize fixture construction. |
| F-010 | P4 Cleanup | OpenSpec validation hygiene | defer | `openspec validate --all --strict` fails only `ssh-tui-server` and `tui-client`; all main specs and this change pass. | Global OpenSpec verification remains noisy. | Archive, complete, or remove stale no-task changes when their ownership is clear. |

## Triage

| Follow-up Type | Findings | Decision |
| --- | --- | --- |
| quick fix | F-001, F-002, F-003, F-004, F-007, F-009 | Commit before the next feature wave. They are small, obvious, and unblock normal play/verification. |
| new OpenSpec change | F-006, F-008 | Create a small verification-focused change rather than mixing test strategy into this read-only review. |
| defer | F-005, F-010 | Revisit when Docker/CI or stale TUI change ownership is available. |
| no action | Prompt history context growth caveat | Current behavior matches the prompt caching design; monitor costs separately. |

## Quick Fix Commit Candidates

1. Fix ready-campaign navigation and add dashboard/setup navigation tests.
2. Restore API typecheck by updating stale `GameEngineToolRegistrar` test construction.
3. Restore API unit test import by fixing `@nestjs/common` mocks for `Optional`.
4. Add `Migration20260424000000` to integration global setup.
5. Implement world diary cursor load-more.
6. Clean lint errors in recently added API tests and external-schema object literals.

## Follow-up OpenSpec Changes

Create one verification-focused follow-up change:

- `core-play-verification-coverage`: covers deterministic/manual smoke verification for the live play loop plus web route/page tests for dashboard Play, setup completion, character sheet, quests, world diary pagination, and responsive play shell coverage.
