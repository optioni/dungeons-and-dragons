# Travel Mechanics Spec

## Purpose

Defines how the player character moves between locations — discovery validation before travel, explicit location discovery via tool call, and procedural location creation with auto-discovery.

## Requirements

### Requirement: Travel validates discovery before moving the player
The system SHALL expose a `travel_to` tool that accepts `campaignId` and `locationId`. Before moving, the tool SHALL query `LocationDiscovery` for a record matching `(campaignId, locationId)`. If no record exists, the tool SHALL return `{ success: false, reason: "UNDISCOVERED_LOCATION" }` without modifying campaign state. If discovered, the tool SHALL set `Campaign.currentLocationId` to the target location and emit a `StateChangedEvent` with `type: 'TRAVEL'` and `entityId: locationId`. After a successful move, if `Campaign.travelEncounterEnabled` is `true`, the tool SHALL execute the encounter roll pipeline (roll, draw, combat start) before returning. The tool result SHALL always include an `encounter` field: `null` if no encounter triggered, or an object with `triggered: true`, `description`, and `monsters` if one fired.

#### Scenario: Travel to a discovered location moves the player
- **WHEN** the LLM calls `travel_to` for a location that has a `LocationDiscovery` record for this campaign
- **THEN** `Campaign.currentLocationId` is updated to the target location id and the tool returns success

#### Scenario: Travel to an undiscovered location returns structured error
- **WHEN** the LLM calls `travel_to` for a location with no `LocationDiscovery` record for this campaign
- **THEN** the tool returns `{ success: false, reason: "UNDISCOVERED_LOCATION" }` and campaign state is unchanged

#### Scenario: Travel emits a StateChangedEvent for quest checking
- **WHEN** `travel_to` succeeds
- **THEN** a `StateChangedEvent` with `type: 'TRAVEL'` and `entityId` equal to the destination `locationId` is emitted so the quest auto-checker can evaluate `REACH_LOCATION` objectives

#### Scenario: Tool result includes encounter field on every successful travel
- **WHEN** `travel_to` succeeds and no encounter is triggered
- **THEN** the tool result contains `encounter: null`

#### Scenario: Tool result includes encounter details when combat is started
- **WHEN** `travel_to` succeeds and the encounter pipeline fires and starts combat
- **THEN** the tool result contains `encounter: { triggered: true, description: "<narrative>", monsters: [...] }`

### Requirement: Locations are discovered via explicit tool call
The system SHALL expose a `discover_location` tool that accepts `campaignId`, `locationId`, `source` (MAP | NPC | EXPLORATION | QUEST), and optional `sourceId`. The tool SHALL create a `LocationDiscovery` record if one does not already exist for `(campaignId, locationId)`. If the location is already discovered, the call SHALL be idempotent and return success. The system SHALL NOT auto-discover locations from narrative — all discovery is initiated by explicit LLM tool calls or by the map-item logic in `give_item`.

#### Scenario: New location discovery creates a LocationDiscovery record
- **WHEN** the LLM calls `discover_location` for a location not yet discovered in this campaign
- **THEN** a new `LocationDiscovery` row is created with the given source and optional sourceId

#### Scenario: Discovering an already-known location is idempotent
- **WHEN** the LLM calls `discover_location` for a location already in `LocationDiscovery` for this campaign
- **THEN** the tool returns success without creating a duplicate row

#### Scenario: NPC source is recorded on discovery
- **WHEN** the LLM calls `discover_location` with `source: NPC` and a `sourceId` pointing to the NPC
- **THEN** the `LocationDiscovery` record stores `source = NPC` and `sourceId = <npcId>`

### Requirement: Procedural location creation auto-discovers the new location
The system SHALL expose a `create_location` tool that accepts `campaignId` and location fields (name, description, currentState, connectedLocationIds, x, y). The tool SHALL persist a new `Location` entity and SHALL automatically call `discover_location` with `source: EXPLORATION` for the created location. The location is immediately reachable via `travel_to` after creation.

#### Scenario: Creating a location auto-creates a discovery record
- **WHEN** the LLM calls `create_location` with valid fields
- **THEN** a new `Location` row and a corresponding `LocationDiscovery` row with `source: EXPLORATION` are both persisted atomically

#### Scenario: Created location is travelable immediately
- **WHEN** a location is created via `create_location`
- **THEN** a subsequent `travel_to` call for that location succeeds because the discovery record exists
