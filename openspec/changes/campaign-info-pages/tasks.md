## 1. API Read Model

- [ ] 1.1 Audit current character, campaign, world, memory, SRD condition, and SRD spell GraphQL fields against the campaign-info specs.
- [ ] 1.2 Add or reuse an owner-scoped campaign-to-character lookup so `/campaign/[id]/character` can load without a manually supplied character id.
- [ ] 1.3 Extend character and inventory GraphQL field coverage for hit dice, conditions, prepared spells, spell slots, item detail stats, and sheet display needs.
- [ ] 1.4 Expose `DiaryEntry` as a GraphQL object type with only player-safe fields: id, campaign id, entry type, in-game date, content, and created timestamp.
- [ ] 1.5 Add an authenticated, owner-scoped `diaryEntries(campaignId, first, after)` relay connection query in `MemoryModule`.
- [ ] 1.6 Add active-status filtering support to `worldEvents` without breaking the existing relay query shape.
- [ ] 1.7 Verify existing `factions`, `npcs`, and `npc(id)` responses include the fields needed by the world overview and NPC profile modal; extend resolvers/entities only for missing fields.

## 2. API Tests

- [ ] 2.1 Add unit or integration coverage for owner and non-owner campaign character lookup behavior.
- [ ] 2.2 Add unit or integration coverage for `diaryEntries` relay pagination, newest-first ordering, and owner scoping.
- [ ] 2.3 Add coverage for `worldEvents(status: ACTIVE)` returning only active events for the owned campaign.
- [ ] 2.4 Add schema or resolver coverage that diary queries do not expose embedding vectors or search metadata.

## 3. Frontend GraphQL Operations

- [ ] 3.1 Create shared `apps/web/graphql/character` operations for campaign character sheet data and inventory data.
- [ ] 3.2 Create shared `apps/web/graphql/world` operations for factions, NPC roster, NPC profile, diary entries, and active world events.
- [ ] 3.3 Keep page components using the shared operation files instead of large inline query strings.

## 4. Character Sheet Page

- [ ] 4.1 Refactor `/campaign/[id]/character` to resolve the campaign character from route context while preserving compatible `?characterId=` deep links.
- [ ] 4.2 Render complete core state: identity, race, class, level, AC, initiative, speed, proficiency bonus, HP, max HP, hit dice remaining, death saves, XP, and currency.
- [ ] 4.3 Render abilities, saving throws, skill proficiencies, and calculated modifiers/bonuses.
- [ ] 4.4 Render active conditions with SRD condition descriptions when available.
- [ ] 4.5 Render spell slots and prepared spell details with SRD spell context when available.
- [ ] 4.6 Render inventory as reference information with equipped/carried state, condition, weight, value, and combat or armor stats.
- [ ] 4.7 Add campaign-level navigation links between play, quests, character, and world pages.

## 5. World Overview Page

- [ ] 5.1 Add `/campaign/[id]/world` behind the existing authenticated page middleware.
- [ ] 5.2 Render factions with goals, disposition badge, power level, and territory names when available.
- [ ] 5.3 Render a paginated NPC roster with name, profession, disposition, current location, and party status.
- [ ] 5.4 Add an on-demand NPC profile modal that loads description, motivation, speech style, current location, party status, and relationships.
- [ ] 5.5 Render diary entries newest-first with the latest seven prominent and older entries accessible through pagination or a collapsed section.
- [ ] 5.6 Render active world events with status, description, source/location context, and deadline or days-remaining information when computable.
- [ ] 5.7 Ensure world overview interactions only expand, paginate, navigate, or open details and do not mutate campaign state.

## 6. Frontend Verification

- [ ] 6.1 Add focused tests or component-level coverage for character sheet data mapping and empty/loading/error states.
- [ ] 6.2 Add focused tests or component-level coverage for world overview panels, pagination controls, NPC modal behavior, and empty states.
- [ ] 6.3 Run API tests relevant to character, memory/diary, and world resolvers.
- [ ] 6.4 Run web typecheck and any available web tests.
- [ ] 6.5 Run `openspec validate campaign-info-pages --strict` after implementation updates.
