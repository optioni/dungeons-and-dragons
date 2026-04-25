## ADDED Requirements

### Requirement: TUI renders an ASCII world map from stored location data
The system SHALL provide an ASCII map renderer in the TUI that reads `Location.coordinates` (x/y) and `Location.connectedLocationIds` to draw discovered locations as labeled nodes connected by ASCII line characters. Only locations present in `LocationDiscovery` for the active campaign SHALL be rendered.

#### Scenario: Discovered locations appear as labeled nodes
- **WHEN** the player opens the world map view and has discovered at least one location
- **THEN** each discovered location is rendered as a bracketed label (e.g. `[Town]`) at its stored coordinate position on a fixed-size grid

#### Scenario: Undiscovered locations are not shown
- **WHEN** the player opens the world map view
- **THEN** locations without a corresponding `LocationDiscovery` row for the active campaign are omitted entirely

#### Scenario: Connected locations are joined by ASCII edges
- **WHEN** two discovered locations list each other in `connectedLocationIds`
- **THEN** the renderer draws an ASCII line (`─`, `│`, or diagonal) between their grid positions

### Requirement: ASCII map fits within a fixed terminal canvas
The map renderer SHALL target a canvas of 80 × 24 characters and SHALL scale or truncate the coordinate space to fit. The current player location SHALL be visually distinguished from other discovered locations (e.g. `[*Town*]`).

#### Scenario: Player's current location is highlighted
- **WHEN** the map is rendered and the campaign's `currentLocationId` matches a discovered location
- **THEN** that location's label is rendered with a distinct marker to indicate it as the current position

#### Scenario: Map renders without overflow on an 80 × 24 canvas
- **WHEN** the world contains many locations spread across a large coordinate range
- **THEN** the map fits within 80 columns and 24 rows without wrapping or cropping node labels mid-character

### Requirement: World map view is keyboard-toggled in the TUI
The TUI SHALL support a dedicated key to open and close the world map view. When open, the map SHALL replace the narrative panel; when closed, the narrative panel is restored.

#### Scenario: Player opens the map view
- **WHEN** the player presses the map toggle key
- **THEN** the narrative panel is replaced by the ASCII world map

#### Scenario: Player closes the map view
- **WHEN** the player presses the map toggle key while the map is visible
- **THEN** the map view is dismissed and the narrative panel is restored

### Requirement: Map refreshes after travel tool calls
After a `travel_to` tool result is processed, the map view SHALL re-query location and discovery data so the current position marker and any newly discovered locations are reflected without requiring the player to close and reopen the view.

#### Scenario: Map updates current position after travel
- **WHEN** a `travel_to` tool call completes during a DM turn and the map view is open
- **THEN** the current location marker moves to the new destination on the next render frame

#### Scenario: Newly discovered location appears after travel
- **WHEN** a `travel_to` tool call results in a new `LocationDiscovery` row and the map view is open
- **THEN** the newly discovered location is added to the rendered map
