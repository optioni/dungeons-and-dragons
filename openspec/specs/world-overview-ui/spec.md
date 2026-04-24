# world-overview-ui Specification

## Purpose
TBD - created by archiving change web-world-map. Update Purpose after archive.
## Requirements
### Requirement: World overview page includes the map and reference panels
The world overview page SHALL include the interactive world map as the primary world reference section while preserving the existing factions, known NPCs, diary entries, and active world events panels on `/campaign/[id]/world`.

#### Scenario: Owner opens world overview with map data
- **WHEN** the campaign owner opens `/campaign/[id]/world`
- **THEN** the page displays the interactive map together with factions, NPCs, diary entries, and active world events for the campaign

#### Scenario: World map data is empty
- **WHEN** the campaign has no visible map nodes for the selected scale
- **THEN** the page displays a map empty state while still rendering the other world overview panels

### Requirement: World overview keeps existing panels read-only
The world overview page SHALL keep factions, NPCs, diary entries, and active world events read-only. Interactions in those panels SHALL only navigate, expand, paginate, search, filter, or open details and SHALL NOT mutate campaign world state.

#### Scenario: Player interacts with reference panels
- **WHEN** the player uses faction, NPC, diary, or world event controls on the world overview page
- **THEN** those interactions do not alter campaign state

#### Scenario: Player searches diary entries
- **WHEN** the player searches or filters diary entries on the world overview page
- **THEN** the page changes the displayed diary results without mutating diary records

### Requirement: World overview layout remains usable across viewport sizes
The world overview page SHALL arrange the map and reference panels so labels, controls, and panels do not overlap on mobile or desktop viewports. The map SHALL keep stable graph dimensions while loading, changing scale, or opening travel confirmation.

#### Scenario: Desktop world overview
- **WHEN** the player opens the world overview on a desktop viewport
- **THEN** the map and reference panels are visible in a layout that supports scanning without overlapping text or controls

#### Scenario: Mobile world overview
- **WHEN** the player opens the world overview on a mobile viewport
- **THEN** the page stacks or collapses sections so map controls, node labels, and panel content remain readable

#### Scenario: Map scale changes
- **WHEN** the player changes map scale
- **THEN** the map area keeps stable dimensions and the surrounding world panels do not shift unpredictably

