## Context

The project repository exists but contains no application code — only documentation, specs, and tooling configuration. This design describes how to bootstrap the monorepo skeleton so that every subsequent feature change has a stable foundation to build on.

The stack is fixed by the design spec: NestJS + GraphQL Yoga + MikroORM + PostgreSQL + pgvector + Redis + BullMQ + Anthropic SDK + Voyage AI on the API side; Nuxt 3 + Nuxt UI v4 + urql on the web side. Package manager is Yarn 4 (Berry) with workspaces.

The repository already has ESLint config and Prettier config requirements defined: `@juuso.piikkila/eslint-config-typescript` (TypeScript preset for API, Vue preset for web) and a single `prettier.config.js` at root.

## Goals / Non-Goals

**Goals:**
- Yarn 4 workspace root with `api/` and `web/` packages
- Shared Prettier config at root; shared ESLint base with workspace-specific overrides
- `api/` NestJS app with all required dependencies installed and wired (GraphQL Yoga, MikroORM, BullMQ, Anthropic SDK, Voyage AI, JWT/passport, @nestjs/config, Vitest)
- `web/` Nuxt 3 app with Nuxt UI v4 and urql installed and configured
- `docker-compose.yml` at root providing PostgreSQL (pgvector-enabled) and Redis
- `api/.env.example` and `web/.env.example` documenting every required environment variable
- MikroORM connected to PostgreSQL; empty initial migration runs; pgvector extension verified
- Both apps start with `yarn dev` and connect to their dependencies cleanly
- Empty Vitest test suite passes in `api/`; empty test suite passes in `web/`
- `api/Dockerfile` and `web/Dockerfile` producing production-ready images runnable in Kubernetes

**Non-Goals:**
- Any feature modules (Auth, Character, Campaign, etc.) — those are separate changes
- GraphQL schema definitions beyond an empty/health-check schema
- Kubernetes manifests, Helm charts, or CI/CD pipeline — just the images themselves
- Database seeding of SRD data (that ships with the first migration change)
- Any frontend pages or UI components beyond Nuxt defaults

## Decisions

### Yarn 4 (Berry) with `nodeLinker: node-modules`
Yarn 4 is the workspace manager. Using `nodeLinker: node-modules` avoids PnP compatibility issues with NestJS, MikroORM CLI, and other tooling that assumes a flat `node_modules`. The `.yarn/` directory and `.yarnrc.yml` are committed; `yarn.lock` is committed.

**Alternatives considered:** npm workspaces — simpler but lacks workspace protocol for cross-package deps. pnpm — strong choice but the ESLint config package is already published assuming npm/yarn resolution.

### NestJS app via CLI scaffold, then manual dependency additions
`nest new api --package-manager yarn --skip-git` generates a minimal NestJS app. Dependencies are then added explicitly rather than through NestJS schematics, to keep full control over versions and avoid schematic-injected boilerplate we don't want.

**Alternative considered:** hand-rolling `package.json` and `main.ts` from scratch — more control but slower and more error-prone for bootstrapping.

### GraphQL Yoga as the HTTP adapter
`@graphql-yoga/nestjs` replaces the default `@nestjs/platform-express` HTTP adapter. It is registered in `AppModule` using `YogaDriver` from `@graphql-yoga/nestjs` with `autoSchemaFile: true` (code-first). An empty `AppResolver` with a placeholder `hello` query prevents GraphQL Yoga from refusing to start without a schema.

**Alternative considered:** Apollo Server (`@nestjs/graphql` + `apollo-server-express`) — heavier and lacks first-class SSE subscription support needed later.

### MikroORM with `@mikro-orm/postgresql` and `@mikro-orm/migrations`
Config lives in `api/mikro-orm.config.ts` and is also referenced by `api/package.json` `mikro-orm` key for CLI usage. The initial migration is created with `yarn mikro-orm migration:create --initial` and contains only `CREATE EXTENSION IF NOT EXISTS vector;` plus any MikroORM housekeeping DDL.

**Alternative considered:** TypeORM — MikroORM was chosen in the design spec for its Unit of Work pattern and superior migration control.

### BullMQ connected but no queues defined
`QueueModule` is registered in `AppModule` with `BullModule.forRootAsync(...)` pointing at `REDIS_URL`. No actual queues are defined in this change — that happens in the WorldModule change.

### Environment config via `@nestjs/config` with validation
`ConfigModule.forRoot({ isGlobal: true, validate })` is placed in `AppModule`. A Zod (or class-validator) schema validates all required env vars at startup so the app fails fast with a clear error if misconfigured. `.env.example` lists every key with description comments.

**Alternative considered:** dotenv directly — loses startup validation and NestJS DI integration.

### Nuxt 3 scaffold via `nuxi init`
`nuxi init web` generates the Nuxt 3 app. Nuxt UI v4 is added via `@nuxt/ui` module. urql is configured as a Nuxt plugin (`plugins/urql.client.ts`) pointing at the API URL from runtime config.

### Docker Compose with `ankane/pgvector` image
The official `postgres` image does not include pgvector. `ankane/pgvector` (or `pgvector/pgvector`) is the standard pgvector-enabled image. The `docker-compose.yml` pins a specific tag for reproducibility. Redis uses the official `redis:7-alpine` image.

**Alternative considered:** standard `postgres` + init SQL to compile the extension — fragile and slow in local dev.

### Single `prettier.config.js` at root
Prettier reads config by traversing up to root, so a single root config covers both workspaces with no duplication. No workspace-level Prettier configs are added.

### Multi-stage Dockerfiles with non-root user
Both `api/Dockerfile` and `web/Dockerfile` use multi-stage builds: a `builder` stage installs all dependencies and compiles, and a lean `runner` stage copies only the production output. The final image runs as a non-root user (`node`) for Kubernetes security posture. The API image exposes `PORT` (default 3000); the web image exposes the Nuxt server port. Neither image bundles `.env` files — all config is injected via Kubernetes environment variables or secrets at runtime.

Node base image: `node:lts-alpine` pinned to the LTS major at time of scaffolding (look up current LTS before writing the Dockerfile).

**Alternative considered:** single-stage builds — simpler but ships devDependencies and build tooling into production, inflating image size significantly.

### ESLint flat config at root + workspace overrides
A root `eslint.config.js` uses `@juuso.piikkila/eslint-config-typescript` base. Each workspace has its own `eslint.config.js` that extends root and applies workspace-specific rules (Vue config for `web/`). Lint is run per-workspace: `yarn workspace api lint` / `yarn workspace web lint`.

## Risks / Trade-offs

- **pgvector image freshness** → Mitigation: pin `pgvector/pgvector:pg17` (or latest stable tag at time of scaffolding); document upgrade path in `docker-compose.yml` comments.
- **Yarn 4 + NestJS CLI compatibility** → Mitigation: use `nodeLinker: node-modules` to avoid PnP issues; test CLI commands (`nest generate`, `mikro-orm migration:create`) before closing the task.
- **GraphQL Yoga placeholder schema** → The `hello` query in `AppResolver` is scaffolding noise. Mitigation: mark it with a TODO comment; it will be removed when the first real resolver is added.
- **urql SSE subscription transport** → urql's default fetch exchange doesn't handle SSE. The correct exchange (`@urql/exchange-subscriptions` with a fetch-based SSE client or `graphql-sse`) must be wired in the plugin from day one, even though no subscriptions exist yet, to avoid having to restructure the client later. Mitigation: configure `subscriptionExchange` with `graphql-sse`'s `createClient` in the Nuxt plugin.
- **MikroORM CLI outside NestJS DI** → `mikro-orm.config.ts` must be importable without the NestJS container (the CLI calls it directly). Mitigation: keep config as a pure object export, reading env vars via `dotenv/config` at the top of the file.
- **Yarn cache in Docker layer** → The `node_modules` install layer must be cached efficiently. Mitigation: copy only `package.json`, `yarn.lock`, and `.yarnrc.yml` before running `yarn install` so the layer is only invalidated when dependencies change, not on source changes.
- **Node LTS version drift** → Pinning `node:lts-alpine` without a version tag means the image changes on rebuild. Mitigation: pin to the current LTS major (e.g. `node:22-alpine`) and note the version; bump intentionally.

## Migration Plan

1. Ensure Docker is running; `docker compose up -d` brings up Postgres + Redis.
2. `cd api && cp .env.example .env` — fill in local values.
3. `cd web && cp .env.example .env` — fill in API URL.
4. `yarn install` at root installs all workspace dependencies.
5. `cd api && yarn mikro-orm migration:up` — runs initial migration, enables pgvector.
6. `yarn workspace api dev` and `yarn workspace web dev` — both apps start cleanly.
7. `yarn workspace api test` — empty suite passes.

Rollback: nothing to roll back; this is greenfield. If setup fails, delete generated files and retry.

## Open Questions

- Which specific `pgvector/pgvector` image tag to pin? (Resolve: use latest stable at time of scaffolding, document in compose file.)
- Should `web/` include a `vitest` setup from day one, or defer to a later change? (Proposal says "empty test suite passes" — lean toward including a trivial Vitest config in `web/` with a single placeholder test to establish the pattern.)
- Yarn workspaces protocol: should internal cross-package deps use `workspace:*`? (Not applicable yet — no shared packages in this change. Establish convention in the monorepo-infrastructure spec.)

## Implementation Notes

**Check latest stable versions before installing any dependency.** Do not assume versions from the design spec or training data — look up the current release for every package (npm registry, GitHub releases, or official docs) and install the latest stable version at scaffolding time. This prevents starting the project already behind on a major version and avoids immediate upgrade churn on the first real feature change.
