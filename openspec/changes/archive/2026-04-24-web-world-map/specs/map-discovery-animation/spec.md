## ADDED Requirements

### Requirement: Newly visible map nodes animate into the graph
The world map SHALL animate nodes and edges that become visible after the currently mounted page observes a map data refresh. Newly visible discovered locations and newly visible frontier nodes SHALL receive an enter animation. The initial map load SHALL NOT animate every node as newly discovered.

#### Scenario: Map item reveals locations
- **WHEN** the player returns to the world overview after receiving a map item that created new `LocationDiscovery` records
- **THEN** locations that were not visible in the previous mounted map state animate into the graph

#### Scenario: NPC or exploration discovery reveals location
- **WHEN** a refreshed map response includes a location newly discovered through NPC dialogue or exploration
- **THEN** that discovered location and its newly visible edges animate into the graph

#### Scenario: Initial map load
- **WHEN** the world map loads for the first time during a page mount
- **THEN** already visible nodes render without being treated as newly discovered

### Requirement: Discovery animation follows authoritative map data
Discovery animation SHALL be derived from differences between previous and current world map query results. The client SHALL NOT infer discovery from narrative text and SHALL NOT persist animation state as campaign data.

#### Scenario: Refetched data contains no new nodes
- **WHEN** the world map query refetches and the visible node ids are unchanged
- **THEN** no discovery enter animation is played

#### Scenario: Page is remounted later
- **WHEN** the player leaves the world overview and later opens it again
- **THEN** nodes already present in the first response for that mount are not replayed as newly discovered

### Requirement: Discovery animation remains optional for reduced motion
The map SHALL respect reduced-motion preferences by rendering newly visible locations without motion while still making the new nodes visible.

#### Scenario: Reduced motion is enabled
- **WHEN** the player's environment indicates reduced motion
- **THEN** newly visible map nodes appear without animated movement or pulsing
