## Why

The project is a fresh repository with no application code. Before any features can be built, the monorepo skeleton needs to exist: workspaces configured, dependencies installed, both apps scaffolded, and local infrastructure running. This is the foundation every subsequent change builds on.

## What Changes

- Add root `package.json` with Yarn 4 workspaces (`api/`, `web/`)
- Add root `prettier.config.js` and shared ESLint base using `@juuso.piikkila/eslint-config-typescript`
- Scaffold `api/` — NestJS app with GraphQL Yoga, MikroORM (PostgreSQL), BullMQ (Redis), Anthropic SDK, Voyage AI SDK, passport/JWT auth, @nestjs/config, Vitest
- Scaffold `web/` — Nuxt 3 app with Nuxt UI v4, urql, ESLint (Vue config)
- Add `docker-compose.yml` at root — PostgreSQL with pgvector extension + Redis
- Add `api/.env.example` and `web/.env.example` with all required variables documented
- Configure MikroORM connection and run empty initial migration
- Verify pgvector extension loads on migration
- Both apps start (`yarn dev`) and connect to their dependencies with no errors
- Empty test suites pass in both apps

## Capabilities

### New Capabilities
- `monorepo-infrastructure`: Yarn workspaces, shared ESLint/Prettier config, root-level tooling
- `api-scaffold`: NestJS app skeleton with all dependencies wired, GraphQL Yoga endpoint at `/graphql`, health check endpoint, MikroORM connected, BullMQ connected, environment config loading
- `web-scaffold`: Nuxt 3 app skeleton with Nuxt UI, urql GraphQL client configured pointing at API
- `local-infrastructure`: Docker Compose for PostgreSQL (pgvector enabled) and Redis with documented setup instructions
- `dockerfiles`: Production Dockerfiles for `api/` and `web/`, suitable for Kubernetes deployment

### Modified Capabilities

## Impact

- Creates `api/` and `web/` workspaces from scratch
- Adds `docker-compose.yml`, `prettier.config.js`, root `package.json`, root `eslint.config.js`
- Adds `api/Dockerfile` and `web/Dockerfile`
- No existing code modified
- All subsequent changes depend on this one
