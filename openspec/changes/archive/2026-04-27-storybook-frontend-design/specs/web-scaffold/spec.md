## ADDED Requirements

### Requirement: Storybook tooling configured
The `web/` workspace SHALL include Storybook tooling configured for the Nuxt app, including scripts to run the local Storybook workbench and to build or verify stories in a non-interactive command.

#### Scenario: Storybook scripts are available
- **WHEN** `apps/web/package.json` is read
- **THEN** it includes scripts for starting Storybook locally and for running Storybook build verification

#### Scenario: Storybook uses Nuxt integration
- **WHEN** Storybook configuration is read
- **THEN** it integrates with the Nuxt web app rather than requiring a separately maintained plain Vue/Vite app shell

#### Scenario: Storybook configuration includes app styling
- **WHEN** Storybook renders a component story
- **THEN** the story has the app's global CSS, font imports, Nuxt UI configuration, and Dark Grimoire theme available
