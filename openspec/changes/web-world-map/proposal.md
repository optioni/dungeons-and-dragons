## Why

The world page needs a visual interactive map so players can see where they are, where they've been, and what lies beyond the fog of war. Location discovery driven by map items and NPC dialogue needs a visual representation. The map is a node graph — locations as nodes, connections as edges — with fog of war hiding undiscovered places.

## What Changes

- World overview page (`/campaign/[id]/world`) — interactive location map, factions panel, NPCs panel, diary entries
- Location map component — SVG/canvas node graph with x/y coordinates from Location entities
  - Discovered locations: named, colour-coded by state (safe/tense/hostile/ruined), active quest indicator
  - Current location: highlighted with distinct marker
  - Unknown connected locations: rendered as faint `???` nodes
  - Click discovered location → travel confirmation dialog → calls `travel_to`
  - Scale switcher: WORLD / REGIONAL / LOCAL / DUNGEON
- Map item discovery: when a map Item is obtained during play, newly discovered locations animate onto the map
- Factions panel — faction list, disposition indicators, territory
- NPCs panel — known NPCs, location, alive/dead status
- Diary panel — recent diary entries, search

## Capabilities

### New Capabilities
- `world-map-ui`: Interactive location graph with fog of war, state colour-coding, travel via click, scale switching
- `world-overview-ui`: Factions, NPCs, and diary panels on the world overview page
- `map-discovery-animation`: Newly discovered locations animate onto the map when a map item is obtained

### Modified Capabilities
- `game-view-ui`: Travel confirmation triggered from map click calls existing `travel_to` tool

## Impact

- All changes in `web/` only
- Depends on `campaign-setup` (Location/Map entities), `game-engine` (`travel_to`, `discover_location`), `memory-system` (diary entries)
- Location x/y coordinates must be set by LLM at creation time (already in spec)
