## ADDED Requirements

### Requirement: OpenSpec tasks include Storybook coverage for UI changes
The project OpenSpec task guidance SHALL require generated `tasks.md` files for UI-visible `apps/web` changes to include Storybook story tasks for new or changed visible states, or to explicitly state why Storybook coverage is not applicable.

#### Scenario: UI change task lists include Storybook tasks
- **WHEN** a change affects visible `apps/web` UI such as components, layout, typography, styling, interactive controls, or visual states
- **THEN** the generated `tasks.md` includes one or more checkbox tasks to add or update Storybook stories for the affected UI states

#### Scenario: Non-visual frontend change explains no Storybook work
- **WHEN** a frontend change affects `apps/web` but has no visible UI impact
- **THEN** the generated `tasks.md` includes an explicit note or task stating that Storybook coverage is not applicable and why

#### Scenario: Backend-only change does not require Storybook tasks
- **WHEN** a change affects only backend, infrastructure, data, or OpenSpec artifacts without visible `apps/web` UI impact
- **THEN** the generated `tasks.md` is not required to mention Storybook
