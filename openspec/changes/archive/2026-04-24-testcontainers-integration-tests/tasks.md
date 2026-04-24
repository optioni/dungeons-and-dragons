## 1. Dependencies and Harness Structure

- [x] 1.1 Add Testcontainers dev dependencies to `apps/api` for generic containers, PostgreSQL, and Redis support.
- [x] 1.2 Choose and document the pinned pgvector-capable PostgreSQL image tag used by the integration test harness.
- [x] 1.3 Add a small integration-test environment handoff helper or file path convention for sharing dynamic service URLs with Vitest workers.

## 2. Global Integration Setup

- [x] 2.1 Refactor `apps/api/src/test-global-setup.ts` to start one PostgreSQL container and one Redis container before integration specs execute.
- [x] 2.2 Build the dynamic `DATABASE_URL` and `REDIS_URL` values from the started containers and expose them for the current process.
- [x] 2.3 Write the dynamic integration-test environment handoff so worker setup can load the container URLs reliably.
- [x] 2.4 Run MikroORM migrations once against the containerized PostgreSQL database during global setup.
- [x] 2.5 Seed SRD reference data once after migrations complete.
- [x] 2.6 Return a Vitest global teardown function that stops both containers and removes generated environment handoff state.
- [x] 2.7 Fail global setup with a clear Docker-required error when containers cannot start.

## 3. Worker Setup and Spec URL Cleanup

- [x] 3.1 Update `apps/api/src/test-setup.ts` to load the generated integration-test environment before integration specs create database or Redis clients.
- [x] 3.2 Replace hardcoded PostgreSQL localhost URLs in integration specs with `process.env.DATABASE_URL`.
- [x] 3.3 Replace hardcoded Redis localhost URLs in integration specs with `process.env.REDIS_URL`.
- [x] 3.4 Keep `apps/api/vitest.integration.config.ts` sequential by preserving `fileParallelism: false`.
- [x] 3.5 Confirm unit-test setup still runs without loading Testcontainers infrastructure.

## 4. Verification

- [x] 4.1 Run `yarn typecheck` from `apps/api`.
- [x] 4.2 Run `yarn test` from `apps/api` and confirm Docker is not required.
- [x] 4.3 Run `yarn test:integration` from `apps/api` with Docker available and confirm migrations, SRD seeding, Redis-backed specs, and pgvector-backed specs pass.
- [x] 4.4 Run `openspec validate "testcontainers-integration-tests" --strict`.
