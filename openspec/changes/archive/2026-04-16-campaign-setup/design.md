## Context

Campaign setup is the first cross-cutting feature in the app: it introduces the initial campaign record, the world-state entities that later systems depend on, and the user-facing flow that turns a new campaign from an empty shell into a persisted starting state. The change spans the API data model, GraphQL schema, LLM orchestration, and the Nuxt setup UI.

The proposal establishes four capabilities:
- `campaign-management`
- `world-entities`
- `npc-entities`
- `world-seed-generation`

These capabilities are foundational for later work in `session-and-llm` and `world-system`, so the design needs to prioritize stable ownership boundaries, explicit persistence rules, and an initialization flow that can fail safely without leaving a half-created world behind.

Constraints that shape the design:
- The backend is NestJS with GraphQL Yoga and MikroORM.
- All list queries must use the shared relay pagination infrastructure.
- LLM model names must come from configuration, never be hardcoded.
- LLM tool calls and orchestration must return structured results instead of surfacing raw exceptions.
- Breaking schema and data-model changes are currently acceptable because the project is still in active development.

## Goals / Non-Goals

**Goals:**
- Introduce persistent campaign, world, and NPC entities required before the first session starts.
- Define a deterministic campaign setup workflow: create campaign shell, generate story concepts, select concept, generate world seed, persist seed, transition campaign into a playable state.
- Keep world generation isolated behind a dedicated application service so later systems can reuse it without coupling UI logic to persistence details.
- Expose GraphQL queries and mutations needed by the dashboard and setup wizard.
- Persist the initial world seed atomically enough that setup can be retried or resumed without manual cleanup.

**Non-Goals:**
- Implement the world tick, NPC agenda processing, or autonomous faction simulation.
- Start the first gameplay session or stream narrative output from the DM session.
- Design the full lore, diary, memory, or prompt-caching systems beyond the setup data they depend on.
- Add speculative editor/admin tooling for modifying the generated world after setup.

## Decisions

### 1. Split setup into two modules with clear ownership

The API should use:
- `CampaignModule` for campaign lifecycle, dashboard queries, and setup mutations that are campaign-centric.
- `WorldModule` for world entities (`Location`, `Map`, `MapLocation`, `LocationDiscovery`, `Faction`, `WorldEvent`, `Npc`, `NpcRelationship`, `NpcItem`) plus persistence services for world seed data.

Rationale:
- This keeps the campaign record and setup state transitions separate from the denser world graph.
- Later world-tick work can extend `WorldModule` without turning `CampaignModule` into a catch-all.
- GraphQL resolvers stay aligned with domain ownership.

Alternatives considered:
- Put all setup-related code in `CampaignModule`.
  Rejected because entity ownership becomes muddy once world simulation features arrive.
- Introduce a dedicated `CampaignSetupModule`.
  Rejected for now because it would mostly orchestrate `CampaignModule` and `WorldModule` without enough standalone surface area to justify another top-level module.

### 2. Model campaign setup as an explicit state machine on `Campaign`

`Campaign` should include a setup status field representing progression through the wizard, such as:
- `DRAFT`: campaign shell exists and character creation and tone selection may still be incomplete
- `CONCEPTS_GENERATED`: story concepts are available
- `READY_TO_PLAY`: world seed has been persisted and setup is complete

Supporting setup fields should live on `Campaign` when they are needed to resume the wizard, for example selected tone, selected concept summary, and the opening-scene payload or a reference to it. Story concept generation must remain blocked until the campaign has an associated character.

Rationale:
- Setup is multi-step and depends on external LLM calls; explicit state prevents ambiguous partial records.
- The frontend can resume reliably after refresh or mutation failure.
- The backend can gate mutations according to campaign status instead of relying on fragile client sequencing.

Alternatives considered:
- Infer setup progress from null checks on campaign/world tables.
  Rejected because it makes retries brittle and complicates authorization and validation.
- Store wizard state only on the client until final submission.
  Rejected because story concept generation is server-side and should survive client interruption.

### 3. Use a staged orchestration service instead of a single opaque “create campaign” mutation

The setup flow should be exposed through discrete GraphQL mutations:
- `createCampaign`
- `generateCampaignStoryConcepts`
- `selectCampaignStoryConcept`
- `generateCampaignWorldSeed`

Internally, these mutations should delegate to a `CampaignSetupService` that coordinates validation, LLM invocation, and transactional persistence.

Rationale:
- The UX described in the proposal is naturally staged.
- Each mutation has a smaller failure surface and clearer retry semantics.
- The setup service centralizes orchestration without leaking UI-specific details into entity services.

Alternatives considered:
- One mutation that takes tone and selected concept and returns a fully created world.
  Rejected because the player must see and choose among concepts before world generation.
- Put orchestration directly in resolvers.
  Rejected because business flow would become hard to test and reuse.

### 4. Persist generated world seed inside a database transaction with idempotency guards

World seed persistence should happen in one application-level transaction that creates or updates:
- `Campaign`
- `Location`, `Map`, `MapLocation`, `LocationDiscovery`
- `Faction`
- `Npc`, `NpcRelationship`, `NpcItem`
- `WorldEvent`

The setup service should prevent duplicate seed application by checking the campaign setup status before writing and by storing enough metadata to detect whether the selected concept has already been applied.

Rationale:
- World generation spans many related tables, and partial writes would be expensive to repair manually.
- A single transaction fits the current development stage and keeps consistency strong.
- Idempotency guards protect against user retries and client reconnects.

Alternatives considered:
- Persist entities incrementally as the LLM emits them.
  Rejected because it increases partial-state risk and provides no current product benefit.
- Use asynchronous background jobs for world generation.
  Rejected because setup is a foreground user action and should complete before the first session starts.

### 5. Separate LLM output schema from persistence entities

The world-generation prompt should target a strict DTO schema representing:
- story concepts
- campaign framing data
- starting locations and map placement
- factions
- key NPCs and their relationships
- initial world events
- antagonist seed data
- opening scene seed

The API should validate this structured output before mapping it into MikroORM entities.

Rationale:
- LLM responses are untrusted input and should not map directly onto entities.
- DTO validation gives a clear boundary for retries and structured error reporting.
- The mapping layer can evolve independently from prompts and entity details.

Alternatives considered:
- Prompt the model to emit entity-shaped JSON matching database fields.
  Rejected because it couples prompt format to persistence details and makes refactors harder.

### 6. Keep setup queries read-optimized for the dashboard and wizard

GraphQL should provide a small set of campaign-focused queries for:
- current user’s campaign list for the dashboard
- a single campaign with setup status and selected setup data
- relay-paginated world/NPC lists for inspection screens if needed during setup

Resolvers should avoid exposing raw ORM graphs; instead they should return campaign-centric view models and connection types where list semantics apply.

Rationale:
- The dashboard and setup wizard do not need the full world graph in one response.
- Narrow queries reduce frontend coupling and make auth checks clearer.
- Relay pagination stays consistent with repository-wide GraphQL conventions.

Alternatives considered:
- Return nested world objects directly from the campaign query.
  Rejected because it will overfetch and become unstable as the world model grows.

### 7. Frontend setup lives in a dedicated wizard route that reads server state, not local-only state

The web app should use:
- `/` as the campaign dashboard for listing campaigns and starting setup
- `/campaign/[id]/setup` as the unified wizard route

The unified setup route should reuse the existing character-creation flow when the campaign has no character, then continue into tone selection, concept selection, and world generation. The wizard should derive step progression from the persisted campaign setup status returned by GraphQL, with local form state used only for in-progress input before mutation submission.

Rationale:
- Reload-safe setup matters because LLM-backed steps can take time or fail.
- Server-derived state prevents the frontend from drifting from the backend’s understanding of progress.
- This route structure matches the proposal and leaves room for a later `/campaign/[id]` gameplay shell.

Alternatives considered:
- A single dashboard modal for setup.
  Rejected because the flow is too stateful and long-running for a modal.
- Separate routes for character creation and campaign setup.
  Rejected because the product flow is one guided setup and the shared route simplifies resume behavior.

### 8. Store the opening scene on `Campaign` and materialize it into the first session later

The opening scene should be persisted on `Campaign` as structured setup output, then converted into the first `GameEvent` when `SessionModule` creates the initial `GameSession`.

It should not be represented as a `WorldEvent` because it is not a persistent world pressure with a lifecycle like `ACTIVE`, `RESOLVED`, or `EXPIRED`; it is a bootstrap narrative seed for the first DM response.

Rationale:
- The product spec says the opening scene is part of the world seed generated before the first session begins.
- Persisting it on `Campaign` keeps setup self-contained and resumable before session systems exist.
- Materializing it into the first session later gives `SessionModule` ownership of session history instead of backfilling game events during setup.

Alternatives considered:
- Store the opening scene as a `WorldEvent`.
  Rejected because `WorldEvent` models diegetic state in the world, not presentation-layer bootstrap text.
- Generate the opening scene only when the first session starts.
  Rejected because it would make setup incomplete and introduce an unnecessary second generation step.

### 9. Model the antagonist as an `Npc` plus campaign pointers and an active `WorldEvent`

The main antagonist should not get a dedicated entity in this change. Instead, setup should persist:
- an `Npc` record for the antagonist
- an active `WorldEvent` representing the antagonist's plan already being in motion
- a structured pointer on `Campaign` such as `antagonistNpcId`
- structured plan-stage state on `Campaign` or campaign-owned setup metadata, rather than relying on `loreDocument`

Rationale:
- The product spec explicitly defines the antagonist as an NPC with an agenda and says the world seed includes an active `WorldEvent`.
- A campaign-level pointer makes it easy for later modules to fetch "the main antagonist" without heuristic queries.
- Plan-stage state must be structured because later prompt assembly and tool calls need deterministic reads and writes.
- `loreDocument` is for narrative facts, not canonical state that tools depend on.

Alternatives considered:
- Add a dedicated `Antagonist` entity now.
  Rejected because it duplicates `Npc` and introduces a special-case model before there is enough unique antagonist behavior to justify it.
- Store antagonist information only in `loreDocument`.
  Rejected because later systems need structured state, not text extraction.

### 10. Persist story concepts on `Campaign` as structured JSON

Story concepts should be stored on `Campaign` as structured JSON during setup, alongside the selected concept, instead of introducing a dedicated `StoryConcept` table.

Rationale:
- Story concepts are short-lived wizard data used by one campaign during setup.
- Storing them on `Campaign` keeps the flow simple and reload-safe without adding another table and resolver surface.
- This matches the current product needs while leaving room to normalize later if audit history or analytics become important.

Alternatives considered:
- Create a dedicated `StoryConcept` table.
  Rejected because there is no current requirement for cross-campaign querying, reuse, or long-term concept history.

### 11. Enforce a minimum playable world seed, not a minimal placeholder world

The world seed should be validated against a minimum playable shape before setup can be marked complete. The baseline should be close to the product spec:
- 3-5 locations, with one designated starting location
- 1 `LocationDiscovery` row for the starting location with `source = SETUP`
- 2-3 factions
- 3-5 key NPCs, including the antagonist
- 1 active antagonist-driven `WorldEvent`
- 1 opening scene seed
- 1 campaign lore document

Rationale:
- The product promise is a living world with threads already in motion, not an empty shell.
- A single location and one NPC is technically valid data but would undercut the dashboard, prompt context, and first-session experience.
- Stronger validation reduces the chance of low-quality LLM output producing an unusable starting state.

Alternatives considered:
- Accept any seed with one location and one NPC.
  Rejected because it is too weak to support the intended narrative and systems behavior.

## Risks / Trade-offs

- [LLM output does not match the expected world-seed schema] -> Validate DTOs strictly, return structured generation errors, and allow regeneration from the current step.
- [Campaign setup gets stuck in an intermediate state after a failed mutation] -> Use explicit setup statuses and only advance status after successful completion of each stage.
- [World seed transaction grows complex as more entities are added] -> Keep mapping logic in focused services and persist through a single orchestration boundary.
- [Dashboard queries become expensive if campaign summaries try to embed too much world data] -> Keep dashboard responses campaign-centric and load world details through separate queries.
- [Frontend and backend disagree on which wizard step is active] -> Treat backend setup status as the source of truth and derive UI routing from it.
- [Repeated user clicks trigger duplicate generation] -> Add status-based guards and mutation idempotency checks around concept selection and seed persistence.
- [Seeded antagonist events do not fit the existing `WorldEvent.source` enum cleanly] -> Add a `SETUP` source value instead of overloading `PLAYER_ACTION` or `WORLD_TICK`.

## Migration Plan

1. Add the new MikroORM entities and any supporting enums/relations for campaigns, world entities, and NPC entities, including campaign-owned setup fields for story concepts, selected concept, opening scene seed, antagonist pointers/state, and `SETUP` enum values where setup-origin records need to be explicit.
2. Create and apply a database migration for the new tables and indexes.
3. Implement module wiring, repositories, and domain services in `CampaignModule` and `WorldModule`.
4. Add GraphQL object types, inputs, enums, queries, and staged setup mutations.
5. Implement LLM-facing DTOs, validation, and the world-seed orchestration service, including minimum playable-seed validation.
6. Build the dashboard and setup wizard against the staged GraphQL API.
7. Verify setup end-to-end by creating a campaign, generating concepts, selecting one, generating the seed, and confirming the resulting records exist.

Rollback strategy:
- Because the project is not deployed, rollback can be handled by reverting the change and running a compensating migration if needed.
- During development, failed setup attempts should be recoverable by deleting draft campaign data rather than preserving backward compatibility.

## Open Questions

None at this time.
