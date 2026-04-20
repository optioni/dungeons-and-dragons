## MODIFIED Requirements

### Requirement: Web dashboard and setup route reflect persisted setup progress
The web application SHALL provide:
- a dashboard page at `/` that lists the current user's campaigns and their setup progress
- a setup route at `/campaign/[id]/setup` that derives the active step from the campaign's persisted `setupStatus` and whether the campaign already has a character

The UI SHALL allow a user to resume an incomplete campaign setup after refresh or re-login. If the campaign does not yet have a character, the route SHALL begin with the existing character-creation step before continuing into tone selection and the later campaign-setup stages. Campaigns with `status = ENDED` SHALL be rendered with a memorial badge and all action buttons (continue setup, play, resume) SHALL be disabled or absent; ended campaigns are displayed as read-only records.

#### Scenario: Dashboard shows continue-setup action
- **WHEN** a user views the dashboard and one of their campaigns is not ready to play
- **THEN** the dashboard renders that campaign with an action that navigates to `/campaign/[id]/setup`

#### Scenario: Setup route resumes from persisted state
- **WHEN** a user opens `/campaign/[id]/setup` for a campaign with generated story concepts but no selected world seed
- **THEN** the route loads the concept-selection step instead of restarting setup from the beginning

#### Scenario: Setup route starts with character creation when no character exists
- **WHEN** a user opens `/campaign/[id]/setup` for a draft campaign with no associated character
- **THEN** the route renders the character-creation step before any tone or story concept step

#### Scenario: Ready campaign does not restart setup
- **WHEN** a user opens `/campaign/[id]/setup` for a campaign that is ready to play
- **THEN** the UI redirects or offers navigation to the campaign's next gameplay destination instead of showing setup steps

#### Scenario: Ended campaign shows memorial badge on dashboard
- **WHEN** a user views the dashboard and one of their campaigns has `status = ENDED`
- **THEN** that campaign card displays a memorial badge and no action buttons for setup or play

#### Scenario: Ended campaign is read-only on dashboard
- **WHEN** a user attempts to interact with an ended campaign card on the dashboard
- **THEN** no navigation to setup or play routes is permitted; the card is purely informational
