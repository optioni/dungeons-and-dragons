## 1. API Map Read Model

- [ ] 1.1 Add GraphQL object types and enum/input support for the world map read model: selected scale, available scales, current location id, discovered nodes, frontier nodes, visible edges, coordinates, state, and optional activity marker fields.
- [ ] 1.2 Add an authenticated owner-scoped `worldMap(campaignId, scale)` query to `WorldResolver`.
- [ ] 1.3 Implement `WorldService.getWorldMap` using existing `Map`, `MapLocation`, `Location`, `LocationDiscovery`, `Campaign`, and quest/objective data without adding new persistence.
- [ ] 1.4 Shape fog-of-war data server-side so undiscovered frontier nodes expose only anonymous node identity, coordinates when safe, and connected discovered ids.
- [ ] 1.5 Include DUNGEON scale data from existing dungeon-room `Location` and `Map` rows when matching map data exists.

## 2. API Coverage

- [ ] 2.1 Add service coverage for discovered nodes, anonymous frontier nodes, visible edges, current location id, and available scales.
- [ ] 2.2 Add coverage proving undiscovered location names, descriptions, current state, NPCs, world events, and diary content are not returned in frontier nodes.
- [ ] 2.3 Add resolver or integration coverage for owner access and non-owner rejection.
- [ ] 2.4 Add coverage for missing coordinates using nullable coordinate fields without failing the map query.
- [ ] 2.5 Add coverage for optional quest/activity markers on discovered nodes when active quest data references a location.

## 3. Web GraphQL Wiring

- [ ] 3.1 Add `WORLD_MAP_QUERY` to `apps/web/graphql/world.ts`.
- [ ] 3.2 Define local TypeScript interfaces for world map nodes, edges, coordinates, map scale, and selected destination state.
- [ ] 3.3 Wire the world page to query `worldMap(campaignId, scale)` with a network refresh path when the selected scale changes.
- [ ] 3.4 Preserve existing factions, NPCs, diary entries, and world events queries on the world page.

## 4. World Map Component

- [ ] 4.1 Create a reusable `apps/web/components/world/WorldMapGraph.vue` SVG component.
- [ ] 4.2 Normalize stored coordinates into a stable SVG viewport and add a deterministic fallback layout for nodes without coordinates.
- [ ] 4.3 Render edges below nodes, discovered nodes with names, and frontier nodes as muted `???` nodes.
- [ ] 4.4 Render state-specific node treatments for safe, tense, hostile, ruined, and unknown states.
- [ ] 4.5 Highlight the current campaign location with a distinct marker.
- [ ] 4.6 Render compact quest/activity markers on discovered nodes when present.
- [ ] 4.7 Make discovered nodes keyboard-focusable and clickable while keeping frontier nodes non-travelable and non-revealing.

## 5. World Page Integration

- [ ] 5.1 Add the map as the primary section at the top of `/campaign/[id]/world`.
- [ ] 5.2 Add a scale switcher for WORLD, REGIONAL, LOCAL, and DUNGEON using only scales available from the map response.
- [ ] 5.3 Add loading and empty states for the map without hiding the existing reference panels.
- [ ] 5.4 Adjust the world page layout so the map and reference panels remain readable on desktop and mobile.
- [ ] 5.5 Ensure map scale changes keep stable map dimensions and do not cause unpredictable panel shifts.
- [ ] 5.6 Add or preserve diary search/filter behavior without mutating diary records.

## 6. Travel Request Flow

- [ ] 6.1 Add a travel confirmation dialog when a discovered non-current node is selected.
- [ ] 6.2 Prevent travel confirmation for the current location and anonymous frontier nodes.
- [ ] 6.3 Resolve or start the active session needed to send a controlled travel player input.
- [ ] 6.4 Submit confirmed travel through the existing `sendPlayerInput(sessionId, text)` mutation instead of calling `travel_to` directly.
- [ ] 6.5 Navigate to `/campaign/[id]/play` or otherwise hand off to the play route so the DM stream handles narrative, tool results, encounters, quest checks, and durable state refresh.
- [ ] 6.6 Surface errors from missing sessions or failed input submission without mutating map state.

## 7. Discovery Animation

- [ ] 7.1 Track visible map node ids for the current page mount.
- [ ] 7.2 Apply enter animation classes only to nodes and edges that appear after a map data refresh.
- [ ] 7.3 Avoid replaying discovery animation for every node on the initial query result.
- [ ] 7.4 Respect reduced-motion preferences by rendering newly visible nodes without motion.
- [ ] 7.5 Refetch or refresh map data when returning from play so map-item, NPC, and exploration discoveries can appear.

## 8. Web Coverage

- [ ] 8.1 Add component tests for discovered nodes, frontier nodes, current-location highlighting, state colours, activity markers, and scale switching.
- [ ] 8.2 Add component tests for keyboard/click interaction and blocked frontier-node travel.
- [ ] 8.3 Add tests for coordinate normalization and deterministic fallback layout.
- [ ] 8.4 Add tests for discovery animation diffing, initial-load behavior, unchanged refetches, and reduced-motion handling.
- [ ] 8.5 Add page-level coverage for travel confirmation submitting through `sendPlayerInput` and preserving existing world overview panels.
- [ ] 8.6 Add responsive or snapshot coverage that the map and panels do not overlap on representative mobile and desktop layouts.

## 9. Verification

- [ ] 9.1 Run focused API tests for the world map read model and owner scoping.
- [ ] 9.2 Run focused web tests for the world map component and world page integration.
- [ ] 9.3 Run `yarn lint` for the affected workspaces or package-local lint commands if the root command stops early.
- [ ] 9.4 Run `yarn typecheck` for the affected API and web workspaces.
- [ ] 9.5 Run `openspec validate web-world-map --strict`.
