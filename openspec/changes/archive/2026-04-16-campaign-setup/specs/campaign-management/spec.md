## ADDED Requirements

### Requirement: Campaign records persist ownership, metadata, and setup state
The system SHALL persist a `Campaign` record owned by exactly one authenticated user. A campaign MAY exist without a character while setup is still in progress, but it SHALL be associated with exactly one character before story concept generation can begin. A campaign SHALL store its gameplay metadata (`name`, `inGameDate`, `currentLocationId`, `loreDocument`, `deathMode`, `createdAt`) and its setup-state fields (`setupStatus`, selected tone, generated story concepts, selected story concept, opening scene seed, antagonist NPC pointer, and structured antagonist plan state).

#### Scenario: Draft campaign is created with setup state
- **WHEN** an authenticated user creates a new campaign shell
- **THEN** a `Campaign` record is persisted for that user with `setupStatus = DRAFT`, no world-seed fields yet, and no required character association yet

#### Scenario: Campaign stores setup outputs after generation
- **WHEN** story concepts are generated and a world seed is successfully persisted
- **THEN** the campaign stores the selected concept, opening scene seed, lore document, current location, and antagonist pointer for later queries

#### Scenario: Campaign access is owner-scoped
- **WHEN** a user requests a campaign owned by another user
- **THEN** the system returns a not-found or forbidden result and does not expose campaign data

### Requirement: Campaign GraphQL queries provide dashboard and setup state
The system SHALL expose owner-scoped GraphQL queries for campaign management:
- `campaigns` as a relay connection returning only campaigns owned by the authenticated user
- `campaign(id: ID!)` returning a single owned campaign with its current setup status and setup metadata needed to resume the wizard

#### Scenario: Dashboard query returns only owned campaigns
- **WHEN** a user queries `campaigns`
- **THEN** the connection includes only campaigns owned by that user

#### Scenario: Campaign list uses relay pagination
- **WHEN** a user queries `campaigns(first: 10, after: <cursor>)`
- **THEN** the response follows the shared relay `Connection/Edge/PageInfo` shape

#### Scenario: Setup query exposes resumable state
- **WHEN** a user queries `campaign(id: <id>)` for a campaign in `CONCEPTS_GENERATED` state
- **THEN** the response includes the persisted tone and generated story concepts needed to resume setup without recomputing them

### Requirement: Campaign creation starts a resumable setup flow
The system SHALL expose a `createCampaign` mutation that creates a draft campaign for the authenticated user and returns the created campaign identifier and setup status. The mutation SHALL NOT create world entities yet.

#### Scenario: Campaign shell is created from dashboard
- **WHEN** an authenticated user calls `createCampaign` with valid campaign input
- **THEN** the system creates a draft campaign and returns its identifier for continued setup

#### Scenario: World data is absent before seeding
- **WHEN** a campaign has only been created via `createCampaign`
- **THEN** no locations, factions, NPCs, or world events exist yet for that campaign

### Requirement: Web dashboard and setup route reflect persisted setup progress
The web application SHALL provide:
- a dashboard page at `/` that lists the current user's campaigns and their setup progress
- a setup route at `/campaign/[id]/setup` that derives the active step from the campaign's persisted `setupStatus` and whether the campaign already has a character

The UI SHALL allow a user to resume an incomplete campaign setup after refresh or re-login. If the campaign does not yet have a character, the route SHALL begin with the existing character-creation step before continuing into tone selection and the later campaign-setup stages.

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
