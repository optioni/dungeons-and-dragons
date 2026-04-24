# world-map-ui Specification

## Purpose
TBD - created by archiving change web-world-map. Update Purpose after archive.
## Requirements
### Requirement: World map data preserves fog of war
The system SHALL expose an authenticated owner-scoped world map read model for a campaign and selected map scale. The read model SHALL include discovered location nodes with allowed display fields, the campaign's current location id, visible edges, available map scales, and anonymous frontier nodes for undiscovered locations adjacent to discovered locations. Frontier nodes SHALL NOT expose undiscovered location names, descriptions, current state, NPCs, world events, or diary content.

#### Scenario: Owner queries world map data
- **WHEN** the campaign owner queries world map data for a campaign and scale
- **THEN** the response includes discovered nodes, anonymous frontier nodes, visible edges, current location id, and available map scales for that campaign

#### Scenario: Undiscovered location details remain hidden
- **WHEN** an undiscovered location is connected to a discovered location
- **THEN** the map response represents it as an anonymous frontier node without exposing its name, description, current state, NPCs, world events, or diary content

#### Scenario: Non-owner queries world map data
- **WHEN** a user queries world map data for another user's campaign
- **THEN** the API rejects the request and does not expose any map nodes or edges from that campaign

### Requirement: World map renders a scale-filtered location graph
The world overview page SHALL render an interactive location graph for the selected map scale using stored `Location.coordinates` when available. The graph SHALL render edges below nodes, discovered locations as named interactive nodes, and anonymous frontier nodes as muted `???` nodes. The graph SHALL provide scale switching for WORLD, REGIONAL, LOCAL, and DUNGEON scales when corresponding map data exists.

#### Scenario: Discovered locations render as named nodes
- **WHEN** the selected map response contains discovered location nodes with coordinates
- **THEN** the map renders each discovered location at a normalized position with its name visible

#### Scenario: Frontier locations render anonymously
- **WHEN** the selected map response contains frontier nodes
- **THEN** the map renders them as muted `???` nodes connected to their discovered neighbours

#### Scenario: Player changes map scale
- **WHEN** the player selects another available map scale
- **THEN** the page refetches or switches to the map data for that scale and renders only nodes and edges in that scale

#### Scenario: Coordinates are missing
- **WHEN** one or more visible nodes do not have stored coordinates
- **THEN** the map places those nodes using a deterministic fallback layout without changing the underlying campaign data

### Requirement: World map communicates location state and current position
The map SHALL visually distinguish the current campaign location from other discovered locations. Discovered locations SHALL be colour-coded by their current state when available, including safe, tense, hostile, and ruined states. Locations with active quest or activity indicators SHALL display a compact marker without exposing hidden quest details.

#### Scenario: Current location is highlighted
- **WHEN** a discovered node id matches the campaign's current location id
- **THEN** the map renders that node with a distinct current-location marker

#### Scenario: Location state affects node treatment
- **WHEN** a discovered node has a current state such as SAFE, TENSE, HOSTILE, or RUINED
- **THEN** the map renders the node with a state-specific visual treatment

#### Scenario: Active quest marker is present
- **WHEN** a discovered node has an active quest or activity indicator in the map response
- **THEN** the map renders a compact marker on that node without requiring the player to open the quests page

### Requirement: World map supports accessible node interaction
The map SHALL make discovered nodes keyboard-focusable and clickable. Selecting a discovered non-current location SHALL open a travel confirmation dialog. Selecting a current location SHALL show its current-location state without offering travel. Frontier nodes SHALL NOT open travel confirmation.

#### Scenario: Player selects discovered destination
- **WHEN** the player activates a discovered non-current location node
- **THEN** the page opens a travel confirmation dialog for that location

#### Scenario: Player selects current location
- **WHEN** the player activates the current location node
- **THEN** the page identifies it as the current location and does not offer a travel action

#### Scenario: Player selects frontier node
- **WHEN** the player activates an anonymous frontier node
- **THEN** the page does not open travel confirmation and does not reveal hidden location details

