## Context

`/campaign/[id]/world` already exists as the campaign reference page for factions, known NPCs, diary entries, and active world events. This change extends that page with an interactive location graph rather than creating a second world overview surface.

The backend already models the map ingredients: `Location.coordinates`, `Location.connectedLocationIds`, `Map.scale`, `MapLocation`, and `LocationDiscovery`. The current GraphQL `locations` query is owner-scoped but returns raw `Location` rows and does not expose whether each location is discovered for the campaign. That is not enough for fog of war because querying all locations in the browser would leak undiscovered names, descriptions, and state.

Travel is currently performed through the DM session flow. The web client sends player input via `sendPlayerInput(sessionId, text)`, the DM stream runs the LLM, and the LLM invokes the existing `travel_to` tool. There is no player-facing GraphQL mutation that directly executes game-engine tools, and adding one would widen the gameplay mutation surface.

## Goals / Non-Goals

**Goals:**

- Add an interactive map section to `/campaign/[id]/world` using the existing Nuxt page and shared `apps/web/graphql/world.ts` operations.
- Render discovered locations with names, coordinates, state colours, current-location emphasis, quest markers, and edges.
- Render undiscovered adjacent locations only as anonymous `???` nodes when they are connected to discovered locations.
- Support scale switching across WORLD, REGIONAL, LOCAL, and DUNGEON maps.
- Keep factions, NPCs, diary entries, and world events on the same world overview page.
- Let the player request travel from a discovered map node through the existing session input and DM/tool path.
- Animate newly discovered locations when map data changes after the player obtains a map item or another discovery source fires.

**Non-Goals:**

- Do not add a direct public GraphQL mutation that executes `travel_to` outside the DM session.
- Do not change the `LocationDiscovery` persistence model or add a `discovered` flag to `Location`.
- Do not build route planning, path cost, hex-grid movement, or multi-step travel automation.
- Do not make factions, NPCs, diary entries, locations, or events editable from the world page.
- Do not redesign the existing world page panels beyond the layout changes needed to fit the map.

## Decisions

### 1. Add a narrow map overview GraphQL read model

Create an authenticated owner-scoped query such as `worldMap(campaignId, scale)` in `WorldModule`. It should return only the data the map is allowed to reveal:

- available maps and selected scale
- current campaign location id
- discovered nodes with `id`, `name`, `coordinates`, `currentState`, `connectedLocationIds`, and lightweight quest/activity indicators when available
- anonymous frontier nodes for undiscovered locations adjacent to discovered nodes, with id, coordinates, and connected discovered ids, but no name, description, state, events, or NPC data
- visible edges between discovered nodes and between discovered nodes and frontier nodes

Rationale: the existing `locations` query exposes full location records and cannot safely power fog of war. A dedicated read model keeps privacy rules server-side and prevents the client from accidentally revealing undiscovered location details.

Alternative considered: query all `locations`, `maps`, and `LocationDiscovery` rows separately and filter in the browser. Rejected because undiscovered names and descriptions would already be delivered to the client.

Alternative considered: add a `discovered` field to `Location`. Rejected because the repo intentionally models discovery as campaign-specific rows in `LocationDiscovery`.

### 2. Reuse the existing world page and operations module

Extend `apps/web/pages/campaign/[id]/world.vue` and `apps/web/graphql/world.ts` instead of creating a new route. The page should become a two-zone world workspace: the map gets the primary top section, and the existing factions, NPCs, diary, and world events panels remain below or beside it depending on viewport width.

Rationale: the campaign info page work already established `/campaign/[id]/world` as the player-facing world overview. Keeping one route avoids duplicated navigation and lets the map share the same fetched campaign context.

Alternative considered: create `/campaign/[id]/map`. Rejected because it splits world reference information across routes before there is a separate map-only workflow.

### 3. Render the graph as SVG with deterministic layout from stored coordinates

Implement the location graph as a Vue component using SVG. Use `Location.coordinates` as the source of truth and normalize coordinates into the component viewport. Edges render beneath nodes. Nodes use stable dimensions and icon/colour treatments:

- current location: distinct marker and stronger ring
- discovered state: colour derived from `currentState` values such as SAFE, TENSE, HOSTILE, or RUINED
- active quest/activity: small badge or marker on the discovered node
- frontier: muted `???` node without inspectable details

Rationale: SVG is enough for a node graph, easy to test in Vue, accessible with labels and keyboard focus, and avoids canvas hit-testing complexity.

Alternative considered: canvas. Rejected for the first implementation because accessibility, tooltips, and node interactions are simpler with SVG.

### 4. Travel requests go through the session input path

Clicking a discovered non-current location opens a confirmation dialog. Confirming sends a controlled player input through `sendPlayerInput` against the active campaign session, for example "Travel to <location name>." The play page already handles `dmStream`, tool results, and post-turn refetches; after confirmation the UI should navigate to `/campaign/[id]/play` or clearly indicate that travel will resolve in the live session.

Rationale: `travel_to` is an LLM tool, not a public frontend mutation. Keeping travel in the session flow preserves narrative mediation, random encounter handling, quest auto-checks, and stream updates.

Alternative considered: expose a direct `travelTo(locationId)` GraphQL mutation. Rejected for this change because it bypasses the established DM tool flow and would require new backend authorization, event, encounter, and UX semantics.

### 5. Discovery animation is client-side diffing over authoritative map data

The map component should remember the previously visible node ids while the page is mounted. When the `worldMap` query refetches and new discovered or frontier nodes appear, apply an enter animation to those nodes and their edges. Trigger refetches when returning from play and after travel/session completion; do not invent a separate discovery event stream in this change.

Rationale: map-item discovery already persists through `LocationDiscovery` during `give_item`. The UI only needs to visualize newly visible data when it next observes the authoritative query result.

Alternative considered: add a dedicated discovery subscription. Rejected because there is no current player-facing world-state subscription, and polling/refetch-on-navigation is enough for a reference page.

## Risks / Trade-offs

- GraphQL read-model scope grows beyond the proposal's "web only" impact -> Keep it to one owner-scoped query that returns already modeled data and no new persistence.
- Map coordinates may be missing or poorly distributed -> Normalize defensively, fall back to a simple radial layout for nodes without coordinates, and keep the fallback deterministic.
- Sending travel as player input may not force the LLM to call `travel_to` -> Use explicit generated text and keep the confirmation copy clear that travel resolves through the DM; if this proves unreliable, a later change can add a first-class travel mutation.
- Large maps can become visually dense -> Filter by selected scale, cap labels on small viewports, and keep pan/zoom as an enhancement only if static scaling is insufficient.
- Discovery animation can replay too often after remounts -> Track animation only for ids that appear during the current page lifetime, not for every initial query result.

## Migration Plan

1. Add the map overview GraphQL DTO/query/service method in `WorldModule`, reusing existing ownership checks and relay conventions where a list is exposed.
2. Add `WORLD_MAP_QUERY` to `apps/web/graphql/world.ts`.
3. Create a reusable world map component under `apps/web/components/world/`.
4. Integrate the component at the top of `/campaign/[id]/world` and preserve the existing factions, NPC, diary, and event panels.
5. Wire the travel confirmation to the active session input path and navigation back to play.
6. Add focused API resolver/service coverage for fog-of-war data shaping and web component/page coverage for rendering, scale switching, unknown frontier nodes, and travel confirmation.

Rollback is low-risk: remove the world map component and query usage from the page. The read-only backend query can remain unused or be removed with no data migration.

## Open Questions

- Should dungeon-scale maps initially include room locations, or should DUNGEON scale be hidden until the dungeon UI work defines room-map expectations?
- Should quest/activity indicators come from existing quest objective data in this change, or should the first map version reserve the marker slot and only show current-location/state/discovery information?
