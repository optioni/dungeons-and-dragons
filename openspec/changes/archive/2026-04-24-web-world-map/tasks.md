## 1. API Map Read Model

- [x] 1.1 Add GraphQL object types and enum/input support for the world map read model: selected scale, available scales, current location id, discovered nodes, frontier nodes, visible edges, coordinates, state, and optional activity marker fields.
- [x] 1.2 Add an authenticated owner-scoped `worldMap(campaignId, scale)` query to `WorldResolver`.
- [x] 1.3 Implement `WorldService.getWorldMap` using existing `Map`, `MapLocation`, `Location`, `LocationDiscovery`, `Campaign`, and quest/objective data without adding new persistence.
- [x] 1.4 Shape fog-of-war data server-side so undiscovered frontier nodes expose only anonymous node identity, coordinates when safe, and connected discovered ids.
- [x] 1.5 Include DUNGEON scale data from existing dungeon-room `Location` and `Map` rows when matching map data exists.

## 2. API Coverage

- [x] 2.1 Add service coverage for discovered nodes, anonymous frontier nodes, visible edges, current location id, and available scales.
- [x] 2.2 Add coverage proving undiscovered location names, descriptions, current state, NPCs, world events, and diary content are not returned in frontier nodes.
- [x] 2.3 Add resolver or integration coverage for owner access and non-owner rejection.
- [x] 2.4 Add coverage for missing coordinates using nullable coordinate fields without failing the map query.
- [x] 2.5 Add coverage for optional quest/activity markers on discovered nodes when active quest data references a location.

## 3. Web GraphQL Wiring

- [x] 3.1 Add `WORLD_MAP_QUERY` to `apps/web/graphql/world.ts`.
- [x] 3.2 Define local TypeScript interfaces for world map nodes, edges, coordinates, map scale, and selected destination state.
- [x] 3.3 Wire the world page to query `worldMap(campaignId, scale)` with a network refresh path when the selected scale changes.
- [x] 3.4 Preserve existing factions, NPCs, diary entries, and world events queries on the world page.

## 4. World Map Component

- [x] 4.1 Create a reusable `apps/web/components/world/WorldMapGraph.vue` SVG component.
- [x] 4.2 Normalize stored coordinates into a stable SVG viewport and add a deterministic fallback layout for nodes without coordinates.
- [x] 4.3 Render edges below nodes, discovered nodes with names, and frontier nodes as muted `???` nodes.
- [x] 4.4 Render state-specific node treatments for safe, tense, hostile, ruined, and unknown states.
- [x] 4.5 Highlight the current campaign location with a distinct marker.
- [x] 4.6 Render compact quest/activity markers on discovered nodes when present.
- [x] 4.7 Make discovered nodes keyboard-focusable and clickable while keeping frontier nodes non-travelable and non-revealing.

## 5. World Page Integration

- [x] 5.1 Add the map as the primary section at the top of `/campaign/[id]/world`.
- [x] 5.2 Add a scale switcher for WORLD, REGIONAL, LOCAL, and DUNGEON using only scales available from the map response.
- [x] 5.3 Add loading and empty states for the map without hiding the existing reference panels.
- [x] 5.4 Adjust the world page layout so the map and reference panels remain readable on desktop and mobile.
- [x] 5.5 Ensure map scale changes keep stable map dimensions and do not cause unpredictable panel shifts.
- [x] 5.6 Add or preserve diary search/filter behavior without mutating diary records.

## 6. Travel Request Flow

- [x] 6.1 Add a travel confirmation dialog when a discovered non-current node is selected.
- [x] 6.2 Prevent travel confirmation for the current location and anonymous frontier nodes.
- [x] 6.3 Resolve or start the active session needed to send a controlled travel player input.
- [x] 6.4 Submit confirmed travel through the existing `sendPlayerInput(sessionId, text)` mutation instead of calling `travel_to` directly.
- [x] 6.5 Navigate to `/campaign/[id]/play` or otherwise hand off to the play route so the DM stream handles narrative, tool results, encounters, quest checks, and durable state refresh.
- [x] 6.6 Surface errors from missing sessions or failed input submission without mutating map state.

## 7. Discovery Animation

- [x] 7.1 Track visible map node ids for the current page mount.
- [x] 7.2 Apply enter animation classes only to nodes and edges that appear after a map data refresh.
- [x] 7.3 Avoid replaying discovery animation for every node on the initial query result.
- [x] 7.4 Respect reduced-motion preferences by rendering newly visible nodes without motion.
- [x] 7.5 Refetch or refresh map data when returning from play so map-item, NPC, and exploration discoveries can appear.

## 8. Web Coverage

- [x] 8.1 Add component tests for discovered nodes, frontier nodes, current-location highlighting, state colours, activity markers, and scale switching.
- [x] 8.2 Add component tests for keyboard/click interaction and blocked frontier-node travel.
- [x] 8.3 Add tests for coordinate normalization and deterministic fallback layout.
- [x] 8.4 Add tests for discovery animation diffing, initial-load behavior, unchanged refetches, and reduced-motion handling.
- [x] 8.5 Add page-level coverage for travel confirmation submitting through `sendPlayerInput` and preserving existing world overview panels.
- [x] 8.6 Add responsive or snapshot coverage that the map and panels do not overlap on representative mobile and desktop layouts.

## 9. Verification

- [x] 9.1 Run focused API tests for the world map read model and owner scoping.
- [x] 9.2 Run focused web tests for the world map component and world page integration.
- [x] 9.3 Run `yarn lint` for the affected workspaces or package-local lint commands if the root command stops early.
- [x] 9.4 Run `yarn typecheck` for the affected API and web workspaces.
- [x] 9.5 Run `openspec validate web-world-map --strict`.
