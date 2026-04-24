## Context

The game already has a play surface and a quests page, plus a partial character page at `/campaign/[id]/character`. The proposal adds two read-only information surfaces outside the main session loop:

- `/campaign/[id]/character` as the complete player-facing character sheet.
- `/campaign/[id]/world` as the campaign world overview for factions, known NPCs, diary entries, and active world events.

Most backend data already exists. `CharacterResolver` exposes `character(id)` and `characterInventory(characterId)`, `WorldResolver` exposes relay connections for `factions`, `npcs`, and `worldEvents`, and `MemoryService` can fetch recent diary entries for context assembly. The main missing backend surface is a player-facing diary query with GraphQL object fields and relay pagination. The frontend also needs shared GraphQL operation files for these pages instead of embedding large page-local queries.

The app is still in active development and not deployed, so GraphQL shape changes are acceptable. This change should still avoid unnecessary data migrations because the proposal is about surfacing existing campaign state, not introducing new game state.

## Goals / Non-Goals

**Goals:**

- Make `/campaign/[id]/character` a complete campaign character sheet reachable from campaign-side navigation.
- Add `/campaign/[id]/world` with scannable panels for factions, known NPCs, diary entries, and world events.
- Reuse existing owner-scoped GraphQL resolvers and relay infrastructure wherever possible.
- Add only missing read/query surfaces, especially diary entry pagination.
- Keep both pages read-only from the player's perspective; gameplay mutations remain in the session and game engine surfaces.
- Keep data loading conventional for this repo: Nuxt pages use urql queries, authenticated API resolvers use `@CurrentUser()`, and list queries use relay connections.

**Non-Goals:**

- No new entities, migrations, or persistence model changes.
- No real-time subscriptions for these pages.
- No world map rendering or spatial map UX; that belongs to `web-world-map`.
- No quest management changes beyond preserving existing navigation compatibility.
- No direct item equip/unequip UX expansion beyond what already exists unless required to avoid regressions; the proposal's information pages should not become a second gameplay command surface.
- No LLM orchestration, prompt caching, or world tick behavior changes.

## Decisions

### 1. Keep the pages read-only and use refetch/cache refresh instead of subscriptions

Both pages should load state through ordinary urql queries and rely on navigation, cache invalidation, or explicit refetch after existing local actions. They should not subscribe to DM stream events.

Rationale: character and world information is reference material, not the live transcript. The session stream already owns real-time narrative and tool-call feedback. Adding subscriptions here would duplicate state flow and make the pages harder to reason about.

Alternatives considered:

- **SSE subscriptions for character/world changes:** rejected because there is no requirement for live updates while reading these pages.
- **Polling on an interval:** acceptable as a fallback for stale data, but not the default. Query-on-entry keeps the first implementation simpler.

### 2. Extend existing API modules instead of adding a campaign-info module

Character sheet data should remain in `CharacterModule`, world overview data should remain in `WorldModule`, and diary query support should live with `MemoryModule`.

Rationale: the pages aggregate domain data, but the backend ownership is already split by domain. A facade module would mostly wrap existing resolvers without adding useful behavior.

Alternatives considered:

- **Single `campaignInfo(campaignId)` aggregate query:** rejected for now because it would bypass existing relay pagination and create a large, page-specific object that is harder to cache and test.
- **Frontend-only aggregation over existing queries:** used where the API already exists, but diary still needs a first-class query because `DiaryEntry` is not currently exposed as a GraphQL object/connection.

### 3. Use relay connections for all list data, including diary entries

`factions`, `npcs`, and `worldEvents` already use `WorldConnectionArgs` and `createRelayConnection`. Diary entries should follow the same pattern with a `DiaryEntryConnection`, owner-scoped `campaignId`, and `first`/`after` pagination.

Rationale: this matches the repo-wide GraphQL convention and supports older diary entries without special casing. The world page can request `first: 7` for the prominent recent section and then page older entries from the same connection.

Alternatives considered:

- **Return `[DiaryEntry]` with a limit argument:** rejected because all list queries should use relay pagination.
- **Expose only `recentDiaryEntries(campaignId)` with a fixed limit:** rejected because the proposal includes older entries collapsed behind the recent seven.

### 4. Treat "known NPCs" as discoverable world data, with the current implementation scoped to existing NPC records

The world page should call the existing `npcs(campaignId, first, after)` connection and display player-relevant fields. If the implementation already has a discovery/encounter marker by the time this change is applied, the resolver should filter to discovered NPCs. If not, v1 should use owner-scoped campaign NPCs and avoid adding a speculative discovery field.

Rationale: the proposal says "known NPCs", but the current world model already carries campaign-scoped NPC state and no new migration is desired. Adding a premature `discovered` flag would violate the proposal's "no new entities or migrations" impact.

Alternatives considered:

- **Add an `NpcDiscovery` table or `discovered` flag:** rejected for this change because discovery semantics belong in a separate world/NPC capability if they are not already present.
- **Hide the NPC panel until discovery exists:** rejected because the page should still be useful with current data.

### 5. Resolve character page identity from campaign context where possible

The existing character page reads a `characterId` query parameter. The completed page should still accept `?characterId=` for compatibility, but campaign navigation should prefer a campaign-derived character lookup if the API exposes one, or pass the known character id from the caller.

Rationale: `/campaign/[id]/character` should work as a campaign information page, not only as a deep link that breaks without an extra query parameter. However, adding a second character query should be based on the current campaign/character API shape during implementation, not assumed in this design.

Alternatives considered:

- **Require `?characterId=` forever:** rejected because it makes primary navigation fragile.
- **Change `character(id)` to `character(campaignId)`:** rejected because it would be a breaking semantic change to an existing resolver; add a separate query only if needed.

### 6. Keep frontend GraphQL operations in shared files

The implementation should move character/world operations into `apps/web/graphql/*` modules, following the existing `quests.ts` pattern, rather than growing page-local query strings.

Rationale: these pages have large field selections and will likely share fragments with future map/play surfaces. Shared operation files keep page components focused on rendering and state.

Alternatives considered:

- **Keep all queries inline in page components:** acceptable for very small pages, but the character page is already large enough that inline operations reduce maintainability.

## Risks / Trade-offs

- **Diary entries are currently not GraphQL object types** -> Add `@ObjectType()`/`@Field()` metadata carefully and avoid exposing embedding/search internals.
- **Character page may need campaign-to-character lookup** -> Prefer reusing existing campaign/character ownership checks; add a narrow query only if implementation confirms navigation cannot provide the id reliably.
- **NPC "known" semantics may be underspecified** -> Do not add persistence. Document and test the chosen v1 behavior against existing data.
- **Large pages can become card-heavy and hard to scan** -> Use dense, domain-appropriate Nuxt UI layouts with clear panels, compact tables/lists, and stable responsive grids.
- **World overview can overfetch nested relationships** -> Keep list queries shallow; load NPC profile details through the existing `npc(id)` query when the modal opens.
- **Read-only promise can be weakened by existing item actions** -> Keep any existing equip/unequip behavior deliberately scoped, or remove it from the information page if specs decide the page must be strictly read-only.

## Migration Plan

1. Add missing GraphQL read support:
   - Expose `DiaryEntry` fields needed by the world page.
   - Add a relay-paginated, owner-scoped `diaryEntries(campaignId, first, after)` query.
   - Add or extend character lookup only if `/campaign/[id]/character` cannot resolve the campaign's character through existing data.
2. Add frontend GraphQL operation modules for character and world information pages.
3. Refactor `/campaign/[id]/character` to use the shared operation module and fill the missing proposal fields.
4. Add `/campaign/[id]/world` with factions, NPC roster/modal, diary, and active world events.
5. Add focused API and frontend tests for the new query surface and page data mapping.

Rollback is straightforward because there is no data migration: remove the new route, operation files, and resolver/query additions.

## Open Questions

None for the design artifact. The implementation should verify whether campaign-to-character lookup already exists before deciding whether to add a narrow resolver.
