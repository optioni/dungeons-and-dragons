## Why

Frontend changes in the web app depend on the Dark Grimoire design system, but today there is no isolated way to review component states without booting full routes, GraphQL mocks, or the play loop. Storybook can provide a stable design workbench, and an OpenSpec task rule can make story coverage an expected part of future UI work instead of an optional afterthought.

## What Changes

- Add Storybook support to `apps/web` so core Nuxt/Vue components can be rendered, reviewed, and developed in isolation with the real web styling.
- Add an initial Storybook story set for high-value Dark Grimoire and play-route components, using static fixtures rather than live API or LLM calls.
- Update OpenSpec task guidance so future UI-facing changes include Storybook story tasks for new or changed visible states.
- Add verification commands for Storybook configuration and story compilation alongside existing lint, typecheck, and test checks.

## Capabilities

### New Capabilities

- `storybook-design-workbench`: Covers Storybook installation, styling integration, story fixtures, baseline component stories, and Storybook verification for the Nuxt web app.

### Modified Capabilities

- `web-scaffold`: Adds Storybook as part of the web workspace tooling surface, including scripts and configuration needed to run or build the component workbench.
- `monorepo-infrastructure`: Adds OpenSpec task guidance requiring Storybook story tasks for UI-visible frontend changes.

## Impact

- `openspec/config.yaml` task rules will gain conditional Storybook guidance for UI-visible changes.
- `apps/web/package.json`, Storybook configuration, and lockfile/dependency metadata will change to add Storybook tooling.
- `apps/web` component stories and static fixtures will be added for selected session and design-system components.
- Routine frontend verification will gain a Storybook build or equivalent story compilation check.
