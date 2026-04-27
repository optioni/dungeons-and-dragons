## 1. API — Event Type and Payload Model

- [x] 1.1 Add `PLAYER_VISIBLE_EVENT` to the session `EventType` enum and GraphQL enum
- [x] 1.2 Define TypeScript types for normalized visible event payloads: `category`, `kind`, `title`, optional `summary`, `entities`, and `values`
- [x] 1.3 Add unit coverage for payload helper/type guards that reject raw tool input/result pass-through

## 2. API — Visible Event Mapper

- [x] 2.1 Create a mapper near session orchestration that accepts `toolName`, `toolInput`, and structured `toolResult`
- [x] 2.2 Map successful combat tool results into `COMBAT` visible events for damage, healing, conditions, death saves, combat start, and combat end
- [x] 2.3 Map successful inventory and resource tool results into `INVENTORY` or `RESOURCE` visible events for item changes, equipment changes, spell slot use, rests, and level-up application
- [x] 2.4 Map successful quest tool results into `QUEST` visible events for quest creation, objective updates, completion, and failure
- [x] 2.5 Map successful travel, discovery, and dungeon movement tool results into `TRAVEL` or `DISCOVERY` visible events when player-witnessed
- [x] 2.6 Ensure failed tool results, memory/search tools, hidden world/faction/agenda tools, and insufficiently safe results produce no visible event
- [x] 2.7 Add mapper tests covering positive mappings and hidden-state non-leakage cases

## 3. API — Persistence and Reconciliation

- [x] 3.1 Persist mapped `PLAYER_VISIBLE_EVENT` rows immediately after the corresponding raw `TOOL_CALL` event
- [x] 3.2 Preserve existing `TOOL_CALL` persistence for LLM context and debugging when a visible event is also emitted
- [x] 3.3 Verify `gameEvents` returns `PLAYER_VISIBLE_EVENT` rows in chronological order with existing event types
- [x] 3.4 Ensure the implementation works with the active game-events pagination flow and does not assume full-history refetches

## 4. Web — GraphQL and Types

- [x] 4.1 Update web GraphQL typing/generated schema expectations to include `PLAYER_VISIBLE_EVENT`
- [x] 4.2 Add frontend TypeScript types or guards for normalized visible event payloads
- [x] 4.3 Update play-route event reconciliation so newly persisted visible events are included after turn completion

## 5. Web — Transcript Milestone Annotations

- [x] 5.1 Create a `MechanicalEventAnnotation` session component for non-combat visible event categories
- [x] 5.2 Style the annotation as Dark Grimoire marginalia: subtle left border, Cinzel micro-label, IM Fell English summary, mono numeric values only
- [x] 5.3 Render `INVENTORY`, `QUEST`, `DISCOVERY`, `TRAVEL`, and non-combat `RESOURCE` events in `TranscriptView`
- [x] 5.4 Ensure transcript annotations never render raw tool payload fields or hidden-state fields
- [x] 5.5 Add frontend tests for inventory, quest, discovery, and hidden-field rendering behavior

## 6. Web — Combat Panel Event Feed

- [x] 6.1 Add a compact combat event feed or affected-row treatment to `CombatPanel`
- [x] 6.2 Render recent `COMBAT` visible events for damage, healing, conditions, and death saves in dense rows rather than cards
- [x] 6.3 Keep routine combat events primarily in the combat panel while allowing only major milestones to appear in transcript annotations
- [x] 6.4 Verify combat feed layout preserves initiative, HP, conditions, action economy, quick actions, and spell slot sections
- [x] 6.5 Add frontend tests for combat event rendering and hidden enemy-stat non-leakage

## 7. Map and Quest Surface Integration

- [x] 7.1 Refresh or reconcile quest UI state when `QUEST` visible events are observed after a turn
- [x] 7.2 Refresh or reconcile world map/current-location state when `DISCOVERY` or `TRAVEL` visible events are observed after a turn
- [x] 7.3 Verify map refreshes use the owner-scoped fog-of-war read model rather than trusting event payloads for hidden location truth

## 8. Verification

- [x] 8.1 Run targeted API unit tests for visible event mapping and persistence
- [x] 8.2 Run targeted web tests for transcript annotations and combat panel event feed
- [x] 8.3 Run `yarn workspace api typecheck`
- [x] 8.4 Run `yarn workspace web typecheck`
- [x] 8.5 Run `openspec validate player-visible-mechanical-events --strict`
