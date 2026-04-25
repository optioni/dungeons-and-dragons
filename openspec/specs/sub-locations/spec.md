# sub-locations Specification

## Purpose
TBD - created by archiving change persistent-npcs-and-sublocations. Update Purpose after archive.
## Requirements
### Requirement: Location supports an optional parent location
The `Location` entity SHALL have a nullable `parentLocationId` integer column (FK → `location.id`). A location with a `parentLocationId` is a sub-location (e.g., "City Archive" inside "Ironhold"). Top-level locations have `parentLocationId = null`. Only one level of nesting is supported; a sub-location SHALL NOT itself have a sub-location as its parent.

#### Scenario: Sub-location is created with a parent
- **WHEN** `create_location` is called with a `parent_location_id`
- **THEN** the new `Location` row has `parentLocationId` set to that value

#### Scenario: Top-level location is created without a parent
- **WHEN** `create_location` is called without `parent_location_id`
- **THEN** the new `Location` row has `parentLocationId = null`

#### Scenario: Existing locations remain valid after migration
- **WHEN** the database migration runs
- **THEN** all pre-existing `Location` rows have `parentLocationId = null` and no existing behaviour changes

### Requirement: World block includes a full current location section
The `loadWorldBlock` method SHALL include a `## Current Location` section containing the current location's name, description, and current state. When the location has a `parentLocationId`, the name SHALL read `"<SubLocation> (inside <ParentLocation>)"`. When at a top-level location, only the location name is shown.

#### Scenario: Current location name and description appear in every DM turn
- **WHEN** `campaign.currentLocationId` is set
- **THEN** the DM world block includes `## Current Location` with the location's name, description, and current state (if any)

#### Scenario: Player is in a sub-location — context shows hierarchy
- **WHEN** `campaign.currentLocationId` resolves to a Location with a non-null `parentLocationId`
- **THEN** the location name in the world block reads `"<sub-location name> (inside <parent location name>)"`

#### Scenario: Player is at a top-level location — context is unchanged
- **WHEN** `campaign.currentLocationId` resolves to a Location with `parentLocationId = null`
- **THEN** the location name shows only the location name with no parent annotation

#### Scenario: No current location set — section is omitted
- **WHEN** `campaign.currentLocationId` is null
- **THEN** the `## Current Location` section is omitted from the world block without error

### Requirement: World block lists known sub-locations when at a top-level location
When the campaign's `currentLocationId` is a top-level location (no parent), the world block SHALL include a `## Known Establishments` section listing all `Location` rows whose `parentLocationId` matches the current location, formatted as `- <name> (id: <id>): <description>`. This allows the DM to reference establishments by ID in tool calls without fabricating IDs.

#### Scenario: Settlement with known sub-locations lists them in context
- **WHEN** `campaign.currentLocationId` is a top-level location that has at least one sub-location
- **THEN** the world block includes `## Known Establishments` with each sub-location's name, ID, and description

#### Scenario: Settlement with no sub-locations omits the section
- **WHEN** `campaign.currentLocationId` is a top-level location with no sub-locations
- **THEN** the `## Known Establishments` section is omitted

#### Scenario: Player inside a sub-location does not see sibling establishment list
- **WHEN** `campaign.currentLocationId` is a sub-location (has a parent)
- **THEN** the `## Known Establishments` section is omitted — the player is already inside a specific place

### Requirement: World block lists all NPCs present at the current location
The `loadWorldBlock` method SHALL include a `## NPCs Present` section listing every `Npc` row with `currentLocationId` matching the campaign's current location. Each entry SHALL include the NPC's name, ID, profession (if any), and disposition (if any). This replaces inferring NPC presence from narrative history. Merchants (NPCs with `NpcItem` rows) SHALL appear in both `## NPCs Present` (identity) and the existing `## Merchant Inventory` section (stock) — the two sections are complementary, not deduplicated.

#### Scenario: NPCs at current location appear in every DM turn
- **WHEN** one or more NPCs have `currentLocationId` matching the campaign's `currentLocationId`
- **THEN** the world block includes `## NPCs Present` listing each NPC's name, id, profession, and disposition

#### Scenario: No NPCs at current location — section is omitted
- **WHEN** no NPCs have `currentLocationId` matching the campaign's current location
- **THEN** the `## NPCs Present` section is omitted from the world block

### Requirement: create_location tool accepts parent_location_id
The `create_location` tool SHALL accept an optional `parent_location_id` integer parameter. The handler SHALL pass this value through to `TravelService.createLocation()`, which SHALL store it on the new `Location` row.

#### Scenario: DM creates a named establishment within a settlement
- **WHEN** the DM invokes `create_location` with a `parent_location_id` matching an existing settlement location
- **THEN** a new `Location` row is created with `parentLocationId` set to that value and returned as `{ success: true, data: { locationId: <id> } }`

### Requirement: Scene prompt modules instruct the DM to persist named locations immediately and distinguish create from discover
The `settlement.txt` and `exploration.txt` prompt modules SHALL include explicit instructions directing the DM to call `create_location` the first time any named establishment or distinct place is introduced, passing the current settlement's location ID as `parent_location_id` when applicable. The modules SHALL also clarify the distinction: `create_location` is for places the DM is inventing on the fly (auto-discovers them); `discover_location` is only for revealing a location that was pre-seeded during campaign setup and already has a known ID. The DM SHALL NOT call `discover_location` with a fabricated or unknown ID.

#### Scenario: Named establishment introduced in settlement scene is persisted
- **WHEN** the DM narrates a named establishment (inn, archive, guild hall, etc.) in a SETTLEMENT scene
- **THEN** the DM calls `create_location` with that name and the current settlement as `parent_location_id` before the narrative continues

#### Scenario: Named location discovered during exploration is persisted
- **WHEN** the DM introduces a distinct named place during an EXPLORATION scene
- **THEN** the DM calls `create_location` for that place so it can be referenced by ID in subsequent tool calls

#### Scenario: DM does not call discover_location with a fabricated ID
- **WHEN** the DM introduces a place that was not pre-seeded during campaign setup
- **THEN** the DM calls `create_location` (which auto-creates a LocationDiscovery row) rather than `discover_location` with a guessed ID

