## 1. Local Infrastructure

- [x] 1.1 Look up latest stable tags for `pgvector/pgvector` and `redis` Docker images
- [x] 1.2 Create `docker-compose.yml` at repo root with pinned `pgvector/pgvector:pg17` Postgres service (port 5432, named volume, health check)
- [x] 1.3 Add Redis service to `docker-compose.yml` using `redis:7-alpine` (port 6379, named volume)
- [x] 1.4 Add header comments to `docker-compose.yml` documenting one-command setup and pgvector upgrade path
- [x] 1.5 Run `docker compose up -d` and verify both containers are healthy

## 2. Monorepo Root

- [x] 2.1 Look up latest stable version of Yarn 4 (Berry)
- [x] 2.2 Create root `package.json` with `name`, `private: true`, `workspaces: ["app/api", "app/web"]`, and `packageManager` field set to the latest Yarn 4 version
- [x] 2.3 Create `.yarnrc.yml` with `nodeLinker: node-modules` and Yarn release path
- [x] 2.4 Initialise Yarn 4 Berry (`yarn set version berry`) and commit `.yarn/releases/` and `.yarnrc.yml`
- [x] 2.5 Look up latest stable version of `prettier` and `@juuso.piikkila/eslint-config-typescript`
- [x] 2.6 Create root `prettier.config.js` with project formatting rules
- [x] 2.7 Create root `eslint.config.js` using `@juuso.piikkila/eslint-config-typescript` base
- [x] 2.8 Add root `package.json` scripts: `lint` (all workspaces), `test` (all workspaces), `dev` (concurrent api + web)

## 3. API Scaffold

- [x] 3.1 Look up latest stable versions of: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@graphql-yoga/nestjs`, `graphql`, `@nestjs/graphql`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/bullmq`, `bullmq`, `@mikro-orm/core`, `@mikro-orm/nestjs`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@anthropic-ai/sdk`, `voyageai`, `vitest`
- [x] 3.2 Scaffold NestJS app via `nest new api --package-manager yarn --skip-git` (or hand-create if CLI unavailable)
- [x] 3.3 Install all API dependencies at latest stable versions resolved in 3.1
- [x] 3.4 Create `api/eslint.config.js` extending root config with TypeScript preset
- [x] 3.5 Create `api/.env.example` documenting all required variables: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `JWT_SECRET`, `LLM_DM_MODEL`, `LLM_BACKGROUND_MODEL`, `PORT`
- [x] 3.6 Register `ConfigModule.forRoot({ isGlobal: true, validate })` in `AppModule` with startup validation schema covering all required env vars
- [x] 3.7 Register `YogaDriver` from `@graphql-yoga/nestjs` in `AppModule` with `autoSchemaFile: true`
- [x] 3.8 Create `AppResolver` with a placeholder `hello: String` query
- [x] 3.9 Create `api/mikro-orm.config.ts` as a pure export readable by MikroORM CLI (reads `.env` via `dotenv/config`)
- [x] 3.10 Register `MikroOrmModule.forRootAsync(...)` in `AppModule` using `DATABASE_URL`
- [x] 3.11 Create initial MikroORM migration containing `CREATE EXTENSION IF NOT EXISTS vector;`
- [x] 3.12 Register `BullModule.forRootAsync(...)` in `AppModule` using `REDIS_URL`
- [x] 3.13 Configure Vitest in `api/vitest.config.ts` and add a placeholder test file
- [x] 3.14 Run `yarn workspace api test` — verify suite passes
- [x] 3.15 Run `yarn workspace api lint` — verify no lint errors
- [ ] 3.16 Copy `.env.example` to `.env`, fill in local values, run `yarn mikro-orm migration:up` — verify pgvector extension enabled
- [ ] 3.17 Run `yarn workspace api dev` — verify app starts and `/graphql` responds

## 4. Web Scaffold

- [x] 4.1 Look up latest stable versions of: `nuxt`, `@nuxt/ui`, `urql`, `graphql-sse`, `@urql/vue` (or `@urql/core`)
- [x] 4.2 Scaffold Nuxt 3 app via `nuxi init web` inside the repo
- [x] 4.3 Install all web dependencies at latest stable versions resolved in 4.1
- [x] 4.4 Add `@nuxt/ui` to `nuxt.config.ts` modules array
- [x] 4.5 Add `NUXT_PUBLIC_API_URL` and `NUXT_PORT` to `nuxt.config.ts` runtime config
- [x] 4.6 Create `web/.env.example` documenting `NUXT_PUBLIC_API_URL` and `NUXT_PORT`
- [x] 4.7 Create `plugins/urql.client.ts` configuring urql with `fetchExchange` and `subscriptionExchange` (using `graphql-sse` `createClient`)
- [x] 4.8 Create `web/eslint.config.js` extending root config with Vue preset from `@juuso.piikkila/eslint-config-typescript`
- [x] 4.9 Configure test runner (Vitest via `@nuxt/test-utils` or standalone) and add a placeholder test
- [x] 4.10 Run `yarn workspace web test` — verify suite passes
- [x] 4.11 Run `yarn workspace web lint` — verify no lint errors
- [ ] 4.12 Run `yarn workspace web dev` — verify Nuxt app starts without console errors

## 5. Dockerfiles

- [x] 5.1 Look up the current Node LTS major version to use as the base image tag (e.g. `node:22-alpine`)
- [x] 5.2 Create `api/Dockerfile` with multi-stage build: `builder` stage installs all deps and compiles to `dist/`; `runner` stage copies `dist/` + production `node_modules`, runs as `node` user
- [x] 5.3 Ensure `api/Dockerfile` copies `package.json`, `yarn.lock`, `.yarnrc.yml` before `yarn install` to maximise layer caching
- [x] 5.4 Create `web/Dockerfile` with multi-stage build: `builder` stage installs deps and runs `nuxi build`; `runner` stage copies `.output/`, runs as `node` user
- [x] 5.5 Ensure `web/Dockerfile` copies dependency files before `yarn install` for layer caching
- [ ] 5.6 Run `docker build -t dnd-api ./api` — verify build succeeds
- [ ] 5.7 Run `docker build -t dnd-web ./web` — verify build succeeds
- [ ] 5.8 Run API image with env vars injected — verify `/graphql` responds and process runs as `node` user
- [ ] 5.9 Run web image with env vars injected — verify Nuxt server starts as `node` user

## 6. Final Verification

- [x] 6.1 Run `yarn install` from repo root on a clean node_modules — verify all workspaces install cleanly
- [x] 6.2 Run root `yarn test` — verify all workspace test suites pass
- [x] 6.3 Run root `yarn lint` — verify lint passes across all workspaces
- [ ] 6.4 Run root `yarn dev` — verify both api and web dev servers start concurrently without errors
- [ ] 6.5 Commit all files with `feat: bootstrap monorepo skeleton`
