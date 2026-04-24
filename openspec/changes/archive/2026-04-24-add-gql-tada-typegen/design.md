## Context

The web app currently uses raw GraphQL string literals and hand-written TypeScript interfaces that mirror the API schema. There is no automated connection between the two: when the API schema changes, the frontend compiles fine but breaks at runtime. `autoSchemaFile: true` in `AppModule` keeps the schema in memory and never writes it to disk, so no tooling can consume it.

The chosen solution is `gql.tada` — a zero-codegen approach where TypeScript infers result and variable types from the schema at compile time using template literal type parsing. The alternative (`@graphql-codegen/cli`) was ruled out because it requires a per-query generation step, produces a large generated file, and adds a mandatory CI step. `gql.tada` needs only a one-time introspection output when the schema changes.

## Goals / Non-Goals

**Goals:**
- Full type safety on all `useQuery`, `useMutation`, and `useSubscription` calls
- Variable types enforced at compile time (passing a wrong variable type is a TS error)
- Result shape narrowed to exactly the selected fields (not the full schema type)
- Remove all hand-written interfaces that duplicate API types
- No per-query build step; `tsc` and the LSP plugin handle everything live

**Non-Goals:**
- Adding new queries or mutations (this change is purely a type-safety layer)
- Changing the runtime behaviour of any query
- Generating mock types for tests

## Decisions

### 1. Schema file location: `schema.graphql` at repo root

**Decision:** Change `autoSchemaFile: true` to `autoSchemaFile: path.join(process.cwd(), '../../schema.graphql')` (or equivalent), writing the schema to the repo root.

**Alternatives considered:**
- `apps/api/schema.graphql` — natural location for an API artifact, but adds a relative path for the web app to reference
- Repo root — both apps can reference it with short paths; standard for monorepos

**Rationale:** A single canonical schema at the root avoids duplication and is the conventional location for GraphQL monorepos.

### 2. Introspection file committed, not gitignored

**Decision:** The `introspect.d.ts` output from `gql.tada` is committed to the repo (`apps/web/introspect.d.ts`).

**Alternatives considered:**
- Gitignore it and regenerate in CI — adds a mandatory CI step and a developer onboarding step
- Generate on `nuxt dev` start — couples devserver startup to schema availability

**Rationale:** Committing it means `tsc` works on a fresh clone with no extra steps. The file is stable (only changes when the schema changes) and adds no meaningful noise to diffs.

### 3. Query documents stay in `graphql/*.ts`, not inlined in components

**Decision:** Keep the existing pattern of exporting query documents from `apps/web/graphql/*.ts`. Convert the raw string exports to `graphql()` calls from `gql.tada`.

**Alternatives considered:**
- Inline `graphql()` calls inside each `.vue` component — collocated, standard React/Vue pattern
- Keep in dedicated files — separation of concerns, avoids large component `<script>` blocks

**Rationale:** The existing separation already works well; this change should be minimal-diff. Inlining can be done as a follow-up if preferred.

### 4. Custom scalar mapping for `JsonScalar`

**Decision:** Add a `scalars` mapping in `gql.tada` config pointing `JSON` → `unknown`.

**Rationale:** The API exposes a `JSON` custom scalar (used for `abilityScores`, `spellSlots`, `preparedSpells`, etc.). Without a mapping, `gql.tada` types these as `unknown` by default, which is acceptable — narrowing them further would require per-field casts anyway given their dynamic shapes.

### 5. SSE subscriptions

**Decision:** No special handling needed. `gql.tada`'s `graphql()` produces a `TypedDocumentNode`, which urql's `useSubscription` accepts natively.

## Risks / Trade-offs

**Schema file can drift from the running API**
→ The schema file is only updated when a developer runs the API and the NestJS bootstrap writes it. If someone adds a field to the API and forgets to commit the new `schema.graphql`, the web app won't see the new field.
→ Mitigation: add a `yarn generate:schema` script that starts the API just long enough to emit the schema file. Document the workflow: change API types → run script → commit both.

**`tadaOutput` must be re-run after schema changes**
→ When `schema.graphql` changes, the developer must run `yarn tada` (or equivalent) in `apps/web` to regenerate `introspect.d.ts`. Forgetting this means stale type inference.
→ Mitigation: add this as a step in the schema update workflow; the TS plugin will show errors if the introspection is stale.

**`JSON` scalar fields lose specificity**
→ Fields typed as `JSON` in the schema (`abilityScores`, `spellSlots`, etc.) will be typed `unknown` in the frontend. Components that currently cast these fields will need to keep their casts.
→ Acceptable trade-off — these fields have dynamic shapes and require runtime validation regardless.

## Migration Plan

1. Change `autoSchemaFile: true` → file path in `AppModule`; start the API once to emit `schema.graphql`
2. Commit `schema.graphql` to repo root
3. Install `gql.tada` and `@0no-co/graphqlsp` in `apps/web`
4. Configure `@0no-co/graphqlsp` plugin in `apps/web/tsconfig.json`
5. Run `gql.tada generate` to produce `introspect.d.ts`; commit it
6. Configure scalar mapping for `JSON` in `gql.tada` setup
7. Convert `apps/web/graphql/*.ts` — replace raw string exports with `graphql()` calls
8. Remove hand-written interfaces from pages and components; fix any resulting type errors
9. Run `yarn typecheck` in `apps/web` — all clean

Rollback: revert steps 7–8 (the raw string queries still work at runtime; only types are affected).
