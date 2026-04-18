## ADDED Requirements

### Requirement: World entities persist campaign-scoped world state
The system SHALL persist the following campaign-scoped world entities:
- `Location` with `name`, `description`, `currentState`, map coordinates, connected locations, and recent events
- `Map` with `name`, `description`, and `scale`
- `MapLocation` linking maps to locations
- `LocationDiscovery` with `campaignId`, `locationId`, `discoveredAt`, `source`, and optional `sourceId`
- `Faction` with `name`, goals, power level, player disposition, and territory
- `WorldEvent` with `description`, optional `locationId`, optional `deadlineInGameDate`, `source`, `status`, optional `outcome`, and `createdAt`

`WorldEvent.source` SHALL include `SETUP` for world events created during initial campaign generation. `LocationDiscovery.source` SHALL include `SETUP` for the player's initial starting-location discovery.

#### Scenario: Seeded world entities are persisted
- **WHEN** a world seed is successfully generated for a campaign
- **THEN** the database contains `Location`, `Map`, `MapLocation`, `Faction`, and `WorldEvent` rows associated with that campaign

#### Scenario: Setup-created world event uses setup source
- **WHEN** the initial antagonist event is created during campaign setup
- **THEN** its `WorldEvent.source` value is `SETUP`

#### Scenario: Starting-location discovery uses setup source
- **WHEN** the starting location is recorded as discovered during campaign setup
- **THEN** the created `LocationDiscovery` row uses `source = SETUP`

### Requirement: Location discovery is derived exclusively from `LocationDiscovery`
The system SHALL treat location discovery as derived data from `LocationDiscovery` records. `Location` itself SHALL NOT store a discovered flag.

#### Scenario: Discovered location is determined by discovery row
- **WHEN** a campaign has a `LocationDiscovery` record for a location
- **THEN** that location is considered discovered for that campaign

#### Scenario: Undiscovered location has no discovery row
- **WHEN** a location exists for a campaign but no `LocationDiscovery` row exists for it
- **THEN** the location is treated as undiscovered for that campaign

### Requirement: World GraphQL queries expose owner-scoped world data
The system SHALL expose authenticated, owner-scoped GraphQL queries for world data:
- `locations` as a relay connection
- `maps` as a relay connection
- `factions` as a relay connection
- `worldEvents` as a relay connection
- single-record lookups for owned world entities by id

List queries SHALL use the shared relay pagination helpers.

#### Scenario: Owner can query campaign locations
- **WHEN** the owner of a campaign queries `locations` for that campaign
- **THEN** the response returns only locations belonging to that campaign

#### Scenario: Non-owner cannot query world data
- **WHEN** a user queries `worldEvents` or `factions` for another user's campaign
- **THEN** the system returns a not-found or forbidden result and does not expose rows from that campaign

#### Scenario: World list queries use relay shape
- **WHEN** a caller queries `factions(first: 5, after: <cursor>)`
- **THEN** the response includes `edges`, `node`, and `pageInfo` fields in the standard relay format
