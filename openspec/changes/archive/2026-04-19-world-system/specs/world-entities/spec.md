## MODIFIED Requirements

### Requirement: World entities persist campaign-scoped world state
The system SHALL persist the following campaign-scoped world entities:
- `Location` with `name`, `description`, `currentState`, map coordinates, connected locations, and recent events
- `Map` with `name`, `description`, and `scale`
- `MapLocation` linking maps to locations
- `LocationDiscovery` with `campaignId`, `locationId`, `discoveredAt`, `source`, and optional `sourceId`
- `Faction` with `name`, goals, power level, player disposition, and territory
- `WorldEvent` with `description`, optional `locationId`, optional `deadlineInGameDate`, `source`, `status`, optional `outcome`, and `createdAt`

`WorldEvent.source` SHALL include `SETUP` for world events created during initial campaign generation, `WORLD_TICK` for events generated during a world tick (including NPC departure events), and `CATASTROPHE` for catastrophic world events triggered by the `trigger_catastrophe` tool. `LocationDiscovery.source` SHALL include `SETUP` for the player's initial starting-location discovery.

#### Scenario: Seeded world entities are persisted
- **WHEN** a world seed is successfully generated for a campaign
- **THEN** the database contains `Location`, `Map`, `MapLocation`, `Faction`, and `WorldEvent` rows associated with that campaign

#### Scenario: Setup-created world event uses setup source
- **WHEN** the initial antagonist event is created during campaign setup
- **THEN** its `WorldEvent.source` value is `SETUP`

#### Scenario: Starting-location discovery uses setup source
- **WHEN** the starting location is recorded as discovered during campaign setup
- **THEN** the created `LocationDiscovery` row uses `source = SETUP`

#### Scenario: NPC departure event uses WORLD_TICK source
- **WHEN** a world tick produces an NPC movement outcome
- **THEN** the created departure `WorldEvent` has `source = WORLD_TICK` and `locationId` set to the NPC's departure location

#### Scenario: Catastrophe event uses CATASTROPHE source
- **WHEN** the `trigger_catastrophe` tool is invoked during a world tick
- **THEN** the created `WorldEvent` has `source = CATASTROPHE`
