## 1. Storybook Tooling

- [x] 1.1 Verify the current Nuxt-compatible Storybook package and setup command for the repo's Nuxt version before changing dependencies.
- [x] 1.2 Add Storybook dependencies and package scripts to `apps/web/package.json`, including a local dev command and a non-interactive build or verification command.
- [x] 1.3 Configure Storybook for the Nuxt web app so stories can render Nuxt/Vue components without a live API, database, Redis, auth session, or LLM provider key.
- [x] 1.4 Load the app's global CSS, font imports, Nuxt UI theme configuration, and Dark Grimoire styling in Storybook previews.

## 2. Baseline Stories

- [x] 2.1 Add shared static Storybook fixtures for session, combat, mechanical event, and world map states.
- [x] 2.2 Add `PlayHeader` stories covering exploration, combat, rest, low HP, and missing-location states.
- [x] 2.3 Add `TranscriptView` stories covering opening narrative, long transcript, streaming text, inner monologue, suggested actions, and mechanical annotations.
- [x] 2.4 Add `CombatPanel` stories covering no combatants, active turn, low HP, and hostile/friendly group states.
- [x] 2.5 Add `DiceRollCard` and `MechanicalEventAnnotation` stories covering combat result, quest progress, world event, and rejected or ignored payload states.
- [x] 2.6 Add `WorldMapGraph` stories covering undiscovered, partially discovered, and dense map states.
- [x] 2.7 Add a small Dark Grimoire visual reference story if it helps inspect typography, color tokens, borders, and motion in one place.

## 3. OpenSpec Task Guidance

- [x] 3.1 Update `openspec/config.yaml` task rules so UI-visible `apps/web` changes require Storybook story tasks for new or changed visible states.
- [x] 3.2 Ensure the task rule allows frontend changes with no visible UI impact to explicitly mark Storybook coverage as not applicable with a reason.
- [x] 3.3 Ensure the task rule does not require backend-only or non-UI changes to mention Storybook.

## 4. Verification

- [x] 4.1 Run the Storybook build or story compilation command and fix any Storybook configuration or story errors.
- [x] 4.2 Run Storybook locally and inspect representative stories with Playwright CLI to confirm they render non-blank, themed Dark Grimoire UI states.
- [x] 4.3 Run web lint and fix all errors.
- [x] 4.4 Run web typecheck and fix all errors.
- [x] 4.5 Run web tests and fix all errors.
