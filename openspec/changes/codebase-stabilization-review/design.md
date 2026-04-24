# Codebase Stabilization Review Design

## Purpose

Audit the implemented D&D Solo Adventure app after the main feature wave. The review should identify correctness risks, spec drift, missing verification, and cleanup work without mixing investigation with implementation.

## Review Rules

- Gather evidence before assigning severity.
- Prefer concrete file paths, command output, and spec references over general impressions.
- Do not fix findings during the first pass unless the user explicitly exits review mode and asks for implementation.
- Split follow-up work into quick maintenance commits or new OpenSpec changes depending on scope.
- Each review slice must end with either findings or a "no issue found" note backed by the evidence inspected.
- The first pass is complete only when every slice has an explicit result and every finding has a severity plus follow-up type.

## Severity Model

| Severity | Meaning |
| --- | --- |
| P0 Blocker | Prevents core play, corrupts data, blocks verification, or makes the app unsafe to run |
| P1 Correctness Bug | User-visible behavior is wrong or core rules/state can diverge |
| P2 Spec Drift | Specs and code disagree, or archived assumptions are stale |
| P3 Test Gap | Behavior exists but lacks meaningful automated verification |
| P4 Cleanup | Maintainability, duplication, naming, or organization issue without immediate behavior risk |

## Follow-up Types

| Type | Use When |
| --- | --- |
| quick fix | Small, obvious, low-risk correction with no design decision |
| new OpenSpec change | Behavior, schema, workflow, or user-facing scope needs design/spec tracking |
| defer | Valid concern, but not worth addressing before the next feature wave |
| no action | Finding is explained by current design or is a false positive |

## Playability Verdict

The review SHALL produce a product-level answer to: "Is the game ready to play?"

| Verdict | Meaning |
| --- | --- |
| ready | A normal player can complete the core loop end to end, and all known gaps are non-blocking |
| ready with caveats | The core loop works, but there are documented issues a tester/player should know before playing |
| not ready | One or more blockers prevent a normal player session or make the result misleading |
| undetermined | The review did not gather enough evidence to make a playability claim |

Minimum ready-to-play criteria:

- A user can register or log in.
- A campaign can be created and opened.
- A character can be created or selected.
- The play screen loads with campaign and character context.
- Player input produces a streamed DM response.
- LLM tool calls can update game state without crashing the stream.
- Combat, check, rest, level-up, and spell-prep flows do not dead-end the player.
- Long rest and world tick behavior works or fails gracefully with a clear player-facing outcome.
- Character, quest, diary/memory, and world state remain inspectable after play.
- Verification has no unexplained blocker that undermines the core loop verdict.

Verdict rule:

- Any unresolved P0 finding forces `not ready`.
- Any unresolved P1 finding that affects the core loop forces `not ready`.
- Any unresolved P1 finding outside the core loop forces at most `ready with caveats`.
- Any undetermined critical journey forces `undetermined` unless it is explicitly out of playability scope.
- P2-P4 findings do not block `ready` unless their combined impact makes the core loop unreliable or misleading.

## Review Slices

### 1. Verification Baseline

Run and record:

- `yarn lint`
- `yarn typecheck`
- `yarn test`
- `yarn workspace api test:integration`
- `openspec list --json`
- `openspec validate --all --strict`

Output required:

| Command | Result | Evidence | Blocking? | Notes |
| --- | --- | --- | --- | --- |
| `yarn lint` | pending |  |  |  |
| `yarn typecheck` | pending |  |  |  |
| `yarn test` | pending |  |  |  |
| `yarn workspace api test:integration` | pending |  |  |  |
| `openspec list --json` | pending |  |  |  |
| `openspec validate --all --strict` | pending |  |  |  |

Completion rule:

- Every command has pass/fail/blocked status.
- Failures include the shortest useful error summary.
- Environment blockers are separated from product failures.
- Any verification blocker becomes a P0 or P1 finding unless clearly unrelated to the app.

### 2. Critical User Journeys

Trace these end to end:

- User registration/login/session auth
- Campaign creation and campaign list/detail access
- Character creation and character sheet visibility
- Main play session route and `dmStream` lifecycle
- LLM tool calls and structured tool error handling
- Combat/check/rest/level-up/spell-prep mechanics
- Long rest and world tick queue behavior
- Quest auto-checking and quest UI state
- Diary entries, memory facts, and context replay
- World overview data: factions, NPCs, events, locations

For each journey, capture:

| Journey | Entrypoints | Happy Path | Failure Path | Tests Found | Result |
| --- | --- | --- | --- | --- | --- |
| User registration/login/session auth | pending | pending | pending | pending | pending |
| Campaign creation and campaign list/detail access | pending | pending | pending | pending | pending |
| Character creation and character sheet visibility | pending | pending | pending | pending | pending |
| Main play session route and `dmStream` lifecycle | pending | pending | pending | pending | pending |
| LLM tool calls and structured tool error handling | pending | pending | pending | pending | pending |
| Combat/check/rest/level-up/spell-prep mechanics | pending | pending | pending | pending | pending |
| Long rest and world tick queue behavior | pending | pending | pending | pending | pending |
| Quest auto-checking and quest UI state | pending | pending | pending | pending | pending |
| Diary entries, memory facts, and context replay | pending | pending | pending | pending | pending |
| World overview data: factions, NPCs, events, locations | pending | pending | pending | pending | pending |

Completion rule:

- Each journey has at least one API and/or web entrypoint listed.
- Each journey has a clear implemented/partial/stale/unverified result.
- Missing failure handling becomes a finding, not a note.

### 3. Spec to Code Alignment

For each relevant `openspec/specs/*/spec.md`, classify current state.

| State | Meaning |
| --- | --- |
| implemented | Code and tests appear to satisfy the requirement |
| partial | Some behavior exists, but requirement is incomplete |
| stale spec | Spec describes behavior that no longer matches code |
| stale code | Code exists for behavior not represented in specs |
| unverified | Appears implemented but has no meaningful verification |

Output required:

| Capability | Spec Path | Code Evidence | Test Evidence | State | Finding |
| --- | --- | --- | --- | --- | --- |
| api-graphql | `openspec/specs/api-graphql/spec.md` | pending | pending | pending | pending |
| character-creation | `openspec/specs/character-creation/spec.md` | pending | pending | pending | pending |
| character-sheet-page | `openspec/specs/character-sheet-page/spec.md` | pending | pending | pending | pending |
| game-session | `openspec/specs/game-session/spec.md` | pending | pending | pending | pending |
| game-view-ui | `openspec/specs/game-view-ui/spec.md` | pending | pending | pending | pending |
| llm-orchestration | `openspec/specs/llm-orchestration/spec.md` | pending | pending | pending | pending |
| game-engine | `openspec/specs/game-engine/spec.md` | pending | pending | pending | pending |
| world-tick | `openspec/specs/world-tick/spec.md` | pending | pending | pending | pending |
| npc-agendas | `openspec/specs/npc-agendas/spec.md` | pending | pending | pending | pending |
| diary-system | `openspec/specs/diary-system/spec.md` | pending | pending | pending | pending |
| memory-facts | `openspec/specs/memory-facts/spec.md` | pending | pending | pending | pending |
| quest-auto-checker | `openspec/specs/quest-auto-checker/spec.md` | pending | pending | pending | pending |
| world-overview-page | `openspec/specs/world-overview-page/spec.md` | pending | pending | pending | pending |
| integration-test-infrastructure | `openspec/specs/integration-test-infrastructure/spec.md` | pending | pending | pending | pending |

Completion rule:

- The table covers all core play capabilities plus any spec directly touched by a P0/P1 finding.
- Every `partial`, `stale spec`, `stale code`, or `unverified` state links to a finding or an explicit defer decision.

### 4. API Architecture

Review:

- Resolver guard coverage and use of shared GraphQL decorators
- Relay pagination consistency for list queries
- Service boundaries and transaction assumptions
- MikroORM entity relationships, nullable fields, and migration state
- LLM model/config usage with no hardcoded model names
- Structured tool responses instead of raw exceptions
- Prompt caching breakpoints and context growth behavior
- Queue/Redis locking around world tick behavior

Output required:

| Check | Evidence | Result | Finding |
| --- | --- | --- | --- |
| Resolver guard coverage | pending | pending | pending |
| Relay pagination consistency | pending | pending | pending |
| Service boundaries and transactions | pending | pending | pending |
| Entity relationships and migrations | pending | pending | pending |
| Config-driven LLM model usage | pending | pending | pending |
| Structured LLM tool errors | pending | pending | pending |
| Prompt caching and context growth | pending | pending | pending |
| Queue locking and world tick safety | pending | pending | pending |

Completion rule:

- Each check names representative files inspected.
- Any raw exception path visible to the LLM becomes a correctness finding.
- Any hardcoded model name becomes a spec drift or correctness finding.

### 5. Web Architecture

Review:

- Route coverage for campaign, character, world, and play screens
- GraphQL operation coverage and cache assumptions
- Stream chunk state handling and idempotency
- Loading, empty, and error states
- Navigation between campaign pages
- Mobile/desktop layout risks for core play UI

Output required:

| Check | Evidence | Result | Finding |
| --- | --- | --- | --- |
| Campaign route coverage | pending | pending | pending |
| Character/world/play route coverage | pending | pending | pending |
| GraphQL operation coverage | pending | pending | pending |
| Stream chunk state handling | pending | pending | pending |
| Loading/empty/error states | pending | pending | pending |
| Campaign navigation | pending | pending | pending |
| Mobile/desktop layout risks | pending | pending | pending |

Completion rule:

- Each core route has an inspected page/component path.
- Stream review includes idempotency for repeated or late stream chunks.
- Missing loading/error/empty handling becomes at least a P3 finding.

### 6. Testing Quality

Review:

- Unit tests for core services and tool behavior
- Integration tests for GraphQL and database-backed flows
- Testcontainers reliability for Postgres, pgvector, Redis, migrations, and seed data
- Frontend component or page tests for stream/UI state
- Brittle tests that depend on shared mutable state

Output required:

| Feature Area | Unit Coverage | Integration Coverage | Frontend Coverage | Result | Finding |
| --- | --- | --- | --- | --- | --- |
| Auth | pending | pending | pending | pending | pending |
| Campaigns | pending | pending | pending | pending | pending |
| Characters | pending | pending | pending | pending | pending |
| Sessions and stream | pending | pending | pending | pending | pending |
| Game engine tools | pending | pending | pending | pending | pending |
| World tick and NPC agendas | pending | pending | pending | pending | pending |
| Quests | pending | pending | pending | pending | pending |
| Diary and memory | pending | pending | pending | pending | pending |
| World overview | pending | pending | pending | pending | pending |
| Testcontainers harness | pending | pending | pending | pending | pending |

Completion rule:

- Coverage means meaningful assertions, not only object construction or snapshot existence.
- Any core journey without automated coverage becomes a P3 finding unless the gap is already covered by a broader integration test.
- Shared mutable state or order-dependent tests become reliability findings.

## First Pass Exit Criteria

The read-only audit can move to triage when:

- The playability verdict is set to `ready`, `ready with caveats`, `not ready`, or `undetermined`.
- Baseline verification has concrete results for every command.
- Every critical journey has entrypoints, tests found, and a result.
- Core play specs have alignment classifications.
- API, web, and testing review tables have no pending rows.
- Every issue has a finding entry with severity, evidence, impact, and suggested action.
- Findings are sorted in ranked order.

The audit should not move to implementation until these criteria are met or the user explicitly narrows the review scope.

## Finding Format

Use this template for each finding:

```md
### [P0/P1/P2/P3/P4] Short Title

- Area: api | web | OpenSpec | tests | infra
- Evidence:
  - `path/to/file.ts`
  - command output or spec reference
- Impact: What breaks or becomes misleading.
- Suggested action: quick fix | new OpenSpec change | defer | no action
- Notes: Optional context or open question.
```
