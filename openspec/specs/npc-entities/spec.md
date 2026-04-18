# NPC Entities

## Purpose

Defines how NPCs are persisted, structured, and queried. NPCs are campaign-scoped entities that carry both narrative characterisation (motivation, personality, speech style) and world-simulation state (location, alive status, agenda, tick scheduling). This spec covers the core `Npc` entity, its related `NpcRelationship` and `NpcItem` tables, and the GraphQL API surface for querying NPC data.

## Requirements

### Requirement: NPC entities persist structured characterisation and world-state fields
The system SHALL persist an `Npc` entity scoped to a campaign with the fields needed for setup and later world simulation: `name`, `description`, `profession`, `coreMotivation`, `personalityTraits`, `speechStyle`, `disposition`, `currentLocationId`, `alive`, optional combat stats (`hp`, `maxHp`), `partyStatus`, optional `agenda`, and optional `nextTickInGameDate`.

#### Scenario: Generated NPC is stored with structured fields
- **WHEN** campaign setup persists a generated key NPC
- **THEN** the NPC row includes structured motivation and personality data in addition to descriptive text

#### Scenario: Antagonist NPC is stored as a normal NPC
- **WHEN** the generated world includes a main antagonist
- **THEN** the antagonist is persisted as an `Npc` in the campaign rather than as a separate antagonist entity

### Requirement: NPC relationships and inventories are persisted explicitly
The system SHALL persist:
- `NpcRelationship` rows linking a source NPC to a target NPC with `type`, `description`, and `disposition`
- `NpcItem` rows linking an NPC to an item with `quantity` and optional merchant price data

Relationship endpoints SHALL belong to the same campaign.

#### Scenario: NPC relationship is stored between campaign NPCs
- **WHEN** setup generates two connected NPCs with a rivalry or alliance
- **THEN** an `NpcRelationship` row is persisted between those NPCs with the generated relationship type and description

#### Scenario: Merchant inventory is stored on NPC items
- **WHEN** setup generates an NPC with stocked items for sale
- **THEN** `NpcItem` rows are persisted for that NPC with quantity and price data

### Requirement: NPC GraphQL queries expose owner-scoped NPC data
The system SHALL expose authenticated, owner-scoped GraphQL queries for NPC data:
- `npcs` as a relay connection for campaign NPCs
- `npc(id: ID!)` returning a single NPC with its relationships and inventory

List queries SHALL use the shared relay pagination infrastructure.

#### Scenario: Owner can query NPC list
- **WHEN** the owner of a campaign queries `npcs`
- **THEN** the response returns only NPCs belonging to that campaign

#### Scenario: NPC detail includes relationships and inventory
- **WHEN** a user queries `npc(id: <id>)` for an owned NPC
- **THEN** the response includes the NPC's structured fields, related `NpcRelationship` records, and `NpcItem` inventory rows

#### Scenario: Non-owner cannot query NPCs
- **WHEN** a user queries an NPC from another user's campaign
- **THEN** the system returns a not-found or forbidden result and does not expose NPC data
