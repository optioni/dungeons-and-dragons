## 1. Database — Campaign and World Schema

- [x] 1.1 Create `Campaign` entity with owner, character, gameplay metadata, and setup-state fields: `setupStatus`, tone, deathMode, generated story concepts JSON, selected concept JSON, opening scene seed, antagonist NPC pointer, and structured antagonist plan state
- [x] 1.2 Create world entities `Location`, `Map`, `MapLocation`, `LocationDiscovery`, `Faction`, and `WorldEvent`, including `SETUP` source enum values for setup-origin world events and starting-location discovery
- [x] 1.3 Create NPC entities `Npc`, `NpcRelationship`, and `NpcItem` with the structured characterization and agenda fields required by the specs
- [x] 1.4 Add entity relations and ownership constraints across Campaign, Character, Location, WorldEvent, Npc, and relationship tables so all world data remains campaign-scoped
- [x] 1.5 Generate MikroORM migration for the new campaign, world, and NPC tables, enums, foreign keys, and indexes

## 2. API Module Scaffold

- [x] 2.1 Create `CampaignModule` with MikroORM entity registration, resolver wiring, and exported services for campaign lifecycle and setup orchestration
- [x] 2.2 Create `WorldModule` with MikroORM entity registration, resolver wiring, and exported services for world and NPC persistence/querying
- [x] 2.3 Register `CampaignModule` and `WorldModule` in `AppModule`
- [x] 2.4 Add service stubs for campaign queries, setup mutations, world queries, and NPC queries so implementation has clear ownership boundaries

## 3. Campaign Management API

- [x] 3.1 Write unit tests for campaign ownership checks and setup-status transitions
- [x] 3.2 Implement campaign creation service logic that creates a draft campaign without any world rows
- [x] 3.3 Implement owner-scoped `campaign(id)` lookup with resumable setup metadata
- [x] 3.4 Implement owner-scoped `campaigns` relay query returning only the authenticated user's campaigns
- [x] 3.5 Create GraphQL types and inputs for `Campaign`, setup status enum, tone/death mode enums, and campaign creation payloads
- [x] 3.6 Create `CampaignResolver` with authenticated `createCampaign`, `campaign`, and `campaigns` operations
- [x] 3.7 Expose enough campaign state for the setup route to determine whether character creation or later setup stages should render next

## 4. World and NPC Query API

- [x] 4.1 Write unit tests for owner-scoped world and NPC query filtering
- [x] 4.2 Implement world query services for `locations`, `maps`, `factions`, and `worldEvents` using the shared relay pagination helpers
- [x] 4.3 Implement NPC query services for `npcs` relay listing and `npc(id)` detail with relationships and inventory
- [x] 4.4 Create GraphQL object types and enums for world entities, location discovery source, world event source/status, NPC party status, and NPC relationship type
- [x] 4.5 Add world and NPC resolvers with authenticated owner-scoped queries and single-record lookups

## 5. Setup Orchestration and LLM Payload Validation

- [x] 5.1 Define DTOs and validators for generated story concepts, selected concept payloads, opening scene seed, antagonist plan state, and full world-seed payloads
- [x] 5.2 Write unit tests for minimum playable-seed validation: 3-5 locations, 2-3 factions, 3-5 key NPCs, antagonist event, opening scene seed, and lore document
- [x] 5.3 Implement `CampaignSetupService.generateCampaignStoryConcepts` to persist 3-4 structured concepts on the campaign using configured LLM model values and reject campaigns that do not yet have a character
- [x] 5.4 Implement `CampaignSetupService.selectCampaignStoryConcept` with validation against the campaign's currently persisted concepts
- [x] 5.5 Implement `CampaignSetupService.generateCampaignWorldSeed` to validate generated payloads, persist campaign/world/NPC records in one transaction, create the starting-location discovery row, and advance the campaign to ready-to-play state
- [x] 5.6 Add idempotency/status guards so repeated setup mutations do not duplicate world seed data and failed attempts preserve the last valid setup state
- [x] 5.7 Return structured step-specific errors from setup mutations instead of raw exceptions

## 6. Setup Mutations and Integration Points

- [x] 6.1 Write integration tests for `createCampaign`, `generateCampaignStoryConcepts`, `selectCampaignStoryConcept`, and `generateCampaignWorldSeed`
- [x] 6.2 Add GraphQL inputs and payload types for the staged setup mutations
- [x] 6.3 Expose authenticated setup mutations in `CampaignResolver` and ensure each mutation enforces campaign ownership and valid status transitions
- [x] 6.4 Persist the opening scene on `Campaign` and keep it available for later materialization into the first `GameEvent`
- [x] 6.5 Persist the antagonist as an `Npc`, an active `WorldEvent` with `source = SETUP`, and campaign-level antagonist pointer/state fields

## 7. Web — Dashboard and Setup Wizard

- [x] 7.1 Create or update the dashboard page at `apps/web/pages/index.vue` to query the authenticated user's campaigns and show their setup progress
- [x] 7.2 Add dashboard actions for starting a new campaign and resuming incomplete setup
- [x] 7.3 Build `apps/web/pages/campaign/[id]/setup.vue` as a unified persisted-state wizard that renders character creation first when the campaign has no character and later setup stages from `campaign(id)` data afterward
- [x] 7.4 Implement the tone and death-mode step that calls `generateCampaignStoryConcepts`
- [x] 7.5 Implement the story concept selection step that calls `selectCampaignStoryConcept`
- [x] 7.6 Implement the world-generation step that calls `generateCampaignWorldSeed`, handles structured errors, and blocks duplicate submission while generation is in flight
- [x] 7.7 Redirect ready-to-play campaigns away from setup and surface the next available destination from the setup route

## 8. Verification

- [x] 8.1 Write integration tests for non-owner access to campaign, world, and NPC queries and setup mutations
- [x] 8.2 Write integration tests proving a failed world-seed validation leaves no partial world rows committed
- [x] 8.3 Write integration tests proving repeated successful world-seed requests do not create duplicate locations, NPCs, or world events
- [x] 8.4 Write integration tests proving the starting location is persisted as discovered via `LocationDiscovery.source = SETUP`
- [x] 8.5 Run API unit tests and integration tests covering campaign setup, world entities, and NPC queries
- [x] 8.6 Run web tests for dashboard and setup wizard flows
