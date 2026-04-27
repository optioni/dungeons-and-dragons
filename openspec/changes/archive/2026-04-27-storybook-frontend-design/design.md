## Context

The web app already has a strong Dark Grimoire design system in `DESIGN.md`, global theme tokens in `apps/web/assets/css/main.css`, and a small set of high-value Vue components under `apps/web/components`. Today those components are mostly exercised through page tests and route-level mocks, which is useful for behavior but awkward for visual review across states such as combat, streaming, low HP, empty transcript, long transcript, map discovery, or player-visible mechanical events.

OpenSpec currently exposes only the packaged `spec-driven` schema, and `openspec/config.yaml` supports additive per-artifact rules keyed by artifact ID. That means this change can keep the default workflow while adding a task-generation rule that makes Storybook story work explicit for UI-visible implementation.

## Goals / Non-Goals

**Goals:**

- Add Storybook to `apps/web` with the real Nuxt, Nuxt UI, font, Tailwind, and Dark Grimoire styling loaded.
- Establish a focused baseline story set for important component states rather than trying to document every component immediately.
- Add an OpenSpec task rule that makes future UI changes include Storybook story tasks for new or changed visual states.
- Make future frontend UI changes include story coverage for new or changed visual states by workflow, not by memory.
- Keep Storybook deterministic by using local fixtures and mocked callbacks instead of live GraphQL, live API, or live LLM calls.

**Non-Goals:**

- No visual regression service such as Chromatic in the first pass.
- No live API-backed stories or Storybook stories that require authentication, PostgreSQL, Redis, or Anthropic/Voyage keys.
- No replacement for Vitest route/component tests; Storybook complements tests but does not prove GraphQL behavior or stream contracts.
- No requirement that backend-only OpenSpec changes mention Storybook.
- No broad component refactor solely to make Storybook prettier.

## Decisions

### Use `openspec/config.yaml` Task Rules Instead of a Custom Schema

Keep the repository on the existing `spec-driven` schema:

```text
proposal -> specs + design -> tasks
```

Add a conditional rule under `rules.tasks` in `openspec/config.yaml` requiring Storybook story tasks whenever implementation touches visible UI, visual states, interactive controls, layout, typography, styling, or component composition. If no Storybook work is needed for a frontend change, the task list must include an explicit "not applicable" note explaining why.

Alternatives considered:

- Add a dedicated `storybook-stories` artifact: rejected because Storybook planning is lightweight enough to live directly in implementation tasks, and a separate artifact would add process weight without much extra clarity.
- Add a project-local `frontend-ui` schema: rejected for now because the desired behavior is just additional task guidance, and schema selection would add another thing to remember when starting frontend changes.
- Make a frontend schema the repository default: rejected because backend/API changes would inherit irrelevant frontend work.

### Put Storybook Coverage in the Task List

The task rule should push generated `tasks.md` files to include a Storybook task group or required checklist entries that answer:

- Which user-facing components or routes are visually affected?
- Which component stories must be added or updated?
- Which states must be covered, including empty, loading/streaming, success, error, dense content, mobile-width, and Dark Grimoire variants when relevant?
- Which fixtures are needed?
- Which states are intentionally covered by tests only, not Storybook?

These entries should be concrete implementation tasks, for example:

```text
## 3. Storybook Coverage

- [ ] 3.1 Add or update stories for <component> covering <states>
- [ ] 3.2 Add static fixtures for <state/data shape>
- [ ] 3.3 Run Storybook build verification
```

For frontend changes that do not alter visible UI, the task list should say that Storybook coverage is not applicable and why. Backend-only changes do not need to mention Storybook.

Alternatives considered:

- Create actual `.stories.*` files during artifact creation: rejected because OpenSpec artifacts should capture intent, while code changes belong to implementation.
- Require stories for every component touched: rejected because some changes are structural, data-only, or invisible. The artifact should require an explicit "not applicable" rationale when no story is needed.

### Use `@nuxtjs/storybook` for Nuxt Integration

Use the Nuxt Storybook module rather than a hand-rolled Vite Storybook setup. The web app already relies on Nuxt auto imports, Nuxt UI, app config, global CSS, and Nuxt module behavior, so the Storybook setup should stay close to Nuxt runtime assumptions.

Expected integration points:

- `apps/web/package.json` scripts for Storybook dev and Storybook build.
- Nuxt config/module registration as required by the selected Storybook package.
- Storybook preview setup that loads the same CSS/fonts and wraps stories in a grimoire surface class when needed.
- No global API client requirement for stories.

Alternatives considered:

- Plain `@storybook/vue3-vite`: rejected because it increases the amount of Nuxt/Nuxt UI/theme behavior we would need to recreate manually.
- A custom internal component gallery route: rejected because Storybook already provides controls, docs, composition, and build verification.

### Keep Stories Close to Components and Fixtures Centralized

Place component stories next to the components they document, using `*.stories.ts` or the Storybook-supported equivalent for Vue components. Put reusable static fixtures under a shared Storybook fixture location such as `apps/web/stories/fixtures`.

Baseline story coverage should focus on:

- `session/PlayHeader.vue`: exploration, combat, rest, low HP, missing location.
- `session/TranscriptView.vue`: opening narrative, long transcript, streaming text, inner monologue, suggested actions, mechanical annotations.
- `session/CombatPanel.vue`: no combatants, active turn, low HP, hostile/friendly groups.
- `session/DiceRollCard.vue` and `session/MechanicalEventAnnotation.vue`: combat result, quest progress, world event, ignored/invalid payload.
- `world/WorldMapGraph.vue`: undiscovered, partial discovery, dense map.
- A small Dark Grimoire token or primitives story if it helps review typography, colors, borders, and motion in one place.

Alternatives considered:

- Central `apps/web/stories` for every story: rejected because component ownership is clearer when stories live beside the component.
- Page-level stories for full Nuxt routes in v1: rejected because page stories would need heavier GraphQL and route mocks before the component story baseline exists.

### Storybook Verification Joins the Frontend Check Set

Add a deterministic Storybook build command and include it in the implementation checklist for this change. Future UI-visible frontend task lists should include Storybook build verification when stories or Storybook config change, plus the repo's existing lint, typecheck, and test sequence.

The first pass should verify:

- Storybook starts or builds without requiring live backend services.
- Stories compile with TypeScript.
- Global Dark Grimoire styling and Nuxt UI styling are visible in stories.

Alternatives considered:

- Only add a dev script: rejected because dev-server startup is weaker than a repeatable CI-style build check.
- Add screenshot testing now: rejected until the story inventory stabilizes.

## Risks / Trade-offs

- [Risk] Storybook dependency versions can move faster than Nuxt integration support. -> Mitigation: use the Nuxt-specific Storybook module, pin versions through the lockfile, and verify with a build command before completing the change.
- [Risk] Stories drift from real route data. -> Mitigation: keep fixtures small, typed where practical, and focused on visual states rather than pretending to be integration tests.
- [Risk] The Storybook task rule is too broad and adds noise to backend changes. -> Mitigation: phrase it conditionally for changes that touch visible `apps/web` UI; backend-only changes do not need Storybook tasks.
- [Risk] Storybook becomes busywork for invisible frontend changes. -> Mitigation: the generated tasks can explicitly mark Storybook as not applicable, but must explain why.
- [Risk] Co-located stories increase component directory noise. -> Mitigation: keep only component-specific stories beside components and move shared fixture data into a central story fixture folder.

## Migration Plan

1. Update `openspec/config.yaml` task rules with conditional Storybook guidance for UI-visible frontend changes.
2. Add Storybook dependencies, config, and scripts to `apps/web`.
3. Add baseline component stories and static fixtures.
4. Run web lint, typecheck, tests, and Storybook build verification.

Rollback is straightforward during active development: remove Storybook dependencies/config/stories and remove the added task rule from `openspec/config.yaml`.

## Open Questions

- None for the current design. The first implementation pass should verify the exact Storybook package/version and generated script names against the current Nuxt/Storybook tooling before editing package metadata.
