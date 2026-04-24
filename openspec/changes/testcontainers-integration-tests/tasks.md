## 1. Dependencies and Harness Structure

- [ ] 1.1 Add Testcontainers dev dependencies to `apps/api` for generic containers, PostgreSQL, and Redis support.
- [ ] 1.2 Choose and document the pinned pgvector-capable PostgreSQL image tag used by the integration test harness.
- [ ] 1.3 Add a small integration-test environment handoff helper or file path convention for sharing dynamic service URLs with Vitest workers.

## 2. Global Integration Setup

- [ ] 2.1 Refactor `apps/api/src/test-global-setup.ts` to start one PostgreSQL container and one Redis container before integration specs execute.
- [ ] 2.2 Build the dynamic `DATABASE_URL` and `REDIS_URL` values from the started containers and expose them for the current process.
- [ ] 2.3 Write the dynamic integration-test environment handoff so worker setup can load the container URLs reliably.
- [ ] 2.4 Run MikroORM migrations once against the containerized PostgreSQL database during global setup.
- [ ] 2.5 Seed SRD reference data once after migrations complete.
- [ ] 2.6 Return a Vitest global teardown function that stops both containers and removes generated environment handoff state.
- [ ] 2.7 Fail global setup with a clear Docker-required error when containers cannot start.

## 3. Worker Setup and Spec URL Cleanup

- [ ] 3.1 Update `apps/api/src/test-setup.ts` to load the generated integration-test environment before integration specs create database or Redis clients.
- [ ] 3.2 Replace hardcoded PostgreSQL localhost URLs in integration specs with `process.env.DATABASE_URL`.
- [ ] 3.3 Replace hardcoded Redis localhost URLs in integration specs with `process.env.REDIS_URL`.
- [ ] 3.4 Keep `apps/api/vitest.integration.config.ts` sequential by preserving `fileParallelism: false`.
- [ ] 3.5 Confirm unit-test setup still runs without loading Testcontainers infrastructure.

## 4. Verification

- [ ] 4.1 Run `yarn typecheck` from `apps/api`.
- [ ] 4.2 Run `yarn test` from `apps/api` and confirm Docker is not required.
- [ ] 4.3 Run `yarn test:integration` from `apps/api` with Docker available and confirm migrations, SRD seeding, Redis-backed specs, and pgvector-backed specs pass.
- [ ] 4.4 Run `openspec validate "testcontainers-integration-tests" --strict`.
