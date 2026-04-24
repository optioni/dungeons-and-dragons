## 1. API: Export Schema to File

- [x] 1.1 In `apps/api/src/app.module.ts`, change `autoSchemaFile: true` to `autoSchemaFile: path.join(process.cwd(), '../../schema.graphql')` and import `path` from `node:path`
- [x] 1.2 Start the API once to emit `schema.graphql` at the repo root, then verify the file exists and is valid SDL
- [x] 1.3 Commit `schema.graphql` to the repo root

## 2. Web: Install and Configure gql.tada

- [x] 2.1 In `apps/web`, add dependencies: `gql.tada` and `@0no-co/graphqlsp`
- [x] 2.2 Add `@0no-co/graphqlsp` to the `plugins` array in `apps/web/tsconfig.json` pointing at `../../schema.graphql` and setting `tadaOutputLocation` to `./introspect.d.ts`
- [x] 2.3 Create `apps/web/graphql/tada.ts` that calls `initGraphQLTada` with the introspection type and a `JSON → unknown` scalar mapping — this is the `graphql` function all query files will import
- [x] 2.4 Run `gql.tada generate` (or `yarn dlx gql.tada generate`) in `apps/web` to produce `introspect.d.ts`
- [x] 2.5 Commit `apps/web/introspect.d.ts`

## 3. Web: Convert Query Documents

- [x] 3.1 Convert `apps/web/graphql/character.ts` — replace raw string exports with `graphql()` calls from `./tada.ts`
- [x] 3.2 Convert `apps/web/graphql/session.ts`
- [x] 3.3 Convert `apps/web/graphql/quests.ts`
- [x] 3.4 Convert `apps/web/graphql/world.ts`

## 4. Web: Remove Hand-Written Interfaces

- [x] 4.1 In `apps/web/pages/campaign/[id]/world.vue`, remove manually defined interfaces (`NpcRosterItem`, `NpcRelationship`, `NpcProfile`, `DiaryEntry`, etc.) and replace with types inferred from the query documents
- [x] 4.2 In `apps/web/pages/campaign/[id]/character.vue`, remove manually defined interfaces (`SpellSlot`, `SrdEquipment`, `SkillRow`, etc.) and replace with inferred types; keep any casts on `JSON` scalar fields
- [x] 4.3 In `apps/web/pages/campaign/[id]/quests.vue`, remove manual interfaces and update `useQuery` calls
- [x] 4.4 In `apps/web/pages/campaign/[id]/play.vue`, remove manual interfaces and update `useQuery` / `useSubscription` calls
- [x] 4.5 In `apps/web/components/session/*.vue`, remove manual interfaces and update any typed query/mutation calls

## 5. Verification

- [x] 5.1 Run `yarn typecheck` in `apps/web` — zero errors
- [x] 5.2 Confirm `data.value` on at least one `useQuery` call shows the narrowed selection-set type in the editor (not `any` or the full schema type)
- [x] 5.3 Introduce a deliberate field typo in one query, confirm TypeScript reports an error, then revert
