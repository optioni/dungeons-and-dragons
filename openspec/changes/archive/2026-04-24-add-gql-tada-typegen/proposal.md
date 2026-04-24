## Why

The frontend defines GraphQL queries as raw strings and maintains hand-written TypeScript interfaces that duplicate the API schema. Schema changes silently break the frontend — there are no type errors until runtime. `gql.tada` eliminates this gap by inferring result and variable types directly from the GraphQL schema at compile time, with no per-query code generation step.

## What Changes

- `autoSchemaFile` in `AppModule` changed from `true` (in-memory) to a file path (`schema.graphql`) so the schema is written to disk and available to `gql.tada`
- `gql.tada` and its TypeScript LSP plugin installed in the web app
- A one-time `tadaOutput` introspection file generated from `schema.graphql` and checked in
- All raw GraphQL string literals in `apps/web/graphql/*.ts` converted to `graphql()` tagged calls
- Hand-written interfaces in page and component files removed, replaced by inferred types from `gql.tada`
- `useQuery` / `useMutation` calls gain typed `data` without manual type parameters

## Capabilities

### New Capabilities

- `graphql-typegen`: End-to-end GraphQL type safety on the frontend — queries, mutations, variables, and response shapes are all inferred from the live schema. Includes schema export from the API and the `gql.tada` setup in the web app.

### Modified Capabilities

_(none — no spec-level behavior changes, only implementation)_

## Impact

**API**
- `apps/api/src/app.module.ts` — `autoSchemaFile` value changed to `'schema.graphql'` (or a path like `../../schema.graphql` at the repo root)
- `schema.graphql` added to the repo root (or `apps/api/`) — generated artifact, gitignored or committed (committed preferred so CI doesn't need a running API)

**Web**
- New dependencies: `gql.tada`, `@0no-co/graphqlsp`
- `tsconfig.json` — add `@0no-co/graphqlsp` plugin pointing at the schema
- `apps/web/graphql/*.ts` — all query strings converted to `graphql()` calls
- `apps/web/pages/**/*.vue` and `apps/web/components/**/*.vue` — hand-written interfaces removed

**Tooling**
- `tadaOutput` introspection file (`introspect.d.ts` or similar) checked in alongside the schema
- Schema re-export step needed when the API schema changes (run `yarn generate` or similar in `apps/web`)
