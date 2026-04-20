## MODIFIED Requirements

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
