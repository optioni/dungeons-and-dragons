## Purpose

The Storybook design workbench provides an isolated environment for developing, inspecting, and verifying the visual states of `apps/web` Vue/Nuxt components with the full Dark Grimoire theme and app styling, independent of backend services or live sessions.

## Requirements

### Requirement: Storybook renders web components with app styling
The web app SHALL provide a Storybook workbench that renders Vue/Nuxt components with the same global CSS, font packages, Nuxt UI theme configuration, and Dark Grimoire design tokens used by the app.

#### Scenario: Storybook loads the grimoire theme
- **WHEN** Storybook renders a web component story
- **THEN** the story has access to the grimoire CSS custom properties, typography fonts, Nuxt UI theme variables, and global utility classes used by `apps/web`

#### Scenario: Storybook runs without backend services
- **WHEN** Storybook is started or built from the web workspace
- **THEN** it does not require a running API server, PostgreSQL database, Redis server, authentication session, or live LLM provider key

### Requirement: Baseline component stories cover important visual states
The web app SHALL include baseline Storybook stories for the core components whose visual states are difficult to inspect through route-level tests alone.

#### Scenario: Session component stories exist
- **WHEN** the Storybook story index is built
- **THEN** stories exist for session components including `PlayHeader`, `TranscriptView`, `CombatPanel`, `DiceRollCard`, and `MechanicalEventAnnotation`

#### Scenario: World map stories exist
- **WHEN** the Storybook story index is built
- **THEN** stories exist for `WorldMapGraph` covering at least undiscovered, partially discovered, and dense map states

#### Scenario: Stories cover state variants
- **WHEN** a baseline story is written for a stateful visual component
- **THEN** it includes representative variants for relevant empty, loading or streaming, normal, dense-content, error or rejected-data, and Dark Grimoire visual states

### Requirement: Stories use deterministic local fixtures
Storybook stories SHALL use static local fixtures and mocked callbacks for component state instead of live GraphQL, route navigation, server sessions, or LLM streams.

#### Scenario: Story fixture data is local
- **WHEN** a story renders data normally fetched from GraphQL or the session stream
- **THEN** the story reads that state from local fixture data or inline static values

#### Scenario: Story interactions are mocked
- **WHEN** a story exposes component actions such as selecting a suggested action, submitting input, or navigating
- **THEN** the action is represented with a local Storybook action or mocked callback rather than a live API mutation or router side effect

### Requirement: Storybook build verification exists
The web workspace SHALL provide a repeatable command that builds Storybook or otherwise verifies story compilation without opening a browser.

#### Scenario: Storybook build succeeds
- **WHEN** the Storybook verification command is run in the web workspace
- **THEN** Storybook compiles all configured stories and exits with code 0

#### Scenario: Storybook verification is part of frontend completion
- **WHEN** a change adds or updates stories or Storybook configuration
- **THEN** its completion checks include the Storybook verification command alongside lint, typecheck, and tests
