## Context

The API integration suite currently assumes PostgreSQL and Redis already exist on localhost. `vitest.integration.config.ts` runs all integration specs sequentially, `test-global-setup.ts` seeds SRD data once before test files start, and individual specs create MikroORM instances directly. Some specs read `process.env.DATABASE_URL`, but others hardcode `postgresql://dnd:dnd@localhost:5432/dnd`; the world tick integration spec also falls back to `redis://localhost:6379`.

The database is not just plain PostgreSQL. Memory and NPC memory tests require the pgvector extension, vector columns, full-text triggers, and migrations to be present. SRD-backed character tests depend on seeded SRD reference rows. This makes a shared container harness a good first step, but not enough to make file-level parallelism safe yet because the current suite still shares mutable database state.

## Goals / Non-Goals

**Goals:**

- Start one pgvector-capable PostgreSQL container per API integration test run.
- Start one Redis container per API integration test run.
- Run MikroORM migrations once before integration specs execute.
- Seed SRD reference data once after migrations.
- Make `DATABASE_URL` and `REDIS_URL` available to every integration test worker.
- Remove hardcoded localhost test URLs from integration specs.
- Keep the current sequential integration test execution model.

**Non-Goals:**

- Per-test or per-file database isolation.
- Re-enabling Vitest file parallelism.
- Replacing existing manual cleanup logic in specs.
- Changing production database, Redis, Docker Compose, GraphQL, or runtime configuration behavior.
- Adding test doubles for PostgreSQL, Redis, pgvector, SRD data, or MikroORM.

## Decisions

### Use Testcontainers only for integration tests

`testcontainers` belongs in API dev dependencies and is only wired through `vitest.integration.config.ts`. Unit tests continue to run without Docker, and application runtime configuration continues to read normal environment variables.

**Alternatives considered:** Requiring `docker compose up` before integration tests. This preserves the current model and still depends on fixed ports, pre-existing state, and manual setup.

### Use a pgvector-enabled PostgreSQL image

The Postgres test container must use an image that already includes pgvector. Running migrations against a vanilla `postgres` image would fail when the migration creates the vector extension or vector columns.

**Alternatives considered:** Installing pgvector inside a vanilla container at startup. That is slower, more brittle, and adds shell provisioning to a TypeScript test harness.

### Keep one shared Postgres container and one shared Redis container per run

The first implementation should match the current suite shape: one shared database, one shared Redis, migrations once, SRD seed once, and `fileParallelism: false`. This removes external service drift without redesigning test isolation at the same time.

**Alternatives considered:** Per-spec containers or per-test schemas. Those would improve isolation but significantly increase runtime and require broad cleanup changes across existing specs.

### Run migrations in global setup before SRD seeding

The global setup should start containers, publish their connection URLs, run MikroORM migrations, then run the SRD seeder. This mirrors the production database boot path and ensures pgvector, triggers, indexes, and all tables exist before any spec touches the database.

**Alternatives considered:** Using `schema.create()` from entity metadata. That is faster for some tests, but it can miss migration-owned details such as extension setup, custom indexes, enum lifecycle, and full-text triggers.

### Use an explicit worker environment handoff

Vitest global setup owns the container lifecycle, but worker processes need reliable access to dynamic connection URLs. The setup should write a small generated integration-test environment file under a temporary path and set `process.env` there; `src/test-setup.ts` should load that file into each worker before specs run. Specs then read `process.env.DATABASE_URL` and `process.env.REDIS_URL`.

**Alternatives considered:** Relying only on `process.env` mutation in global setup. That can be sensitive to worker process boundaries and makes failures harder to diagnose.

### Return container teardown from global setup

The global setup should keep references to the started containers and stop them in the teardown function returned to Vitest. Teardown must run even when tests fail so ports, Docker resources, and temporary env files are cleaned up.

**Alternatives considered:** Letting Testcontainers reaper cleanup handle everything. It is useful as a fallback, but explicit teardown makes local runs and CI behavior easier to reason about.

## Risks / Trade-offs

- **Docker is unavailable or not running** -> Mitigation: fail early in global setup with a clear message that `yarn test:integration` requires Docker.
- **Container startup increases test latency** -> Mitigation: use one shared Postgres and one shared Redis per run instead of per-test containers.
- **pgvector image tag drifts or disappears** -> Mitigation: pin a known pgvector image tag in the test setup and keep it near the integration harness code.
- **Generated env handoff becomes stale after a failed run** -> Mitigation: write it into a temporary integration-test path and delete it during teardown; setup files should only load it for the integration Vitest config.
- **Shared database state still couples specs** -> Mitigation: keep `fileParallelism: false` and explicitly defer parallelism or stronger isolation to a later change.
- **SRD spec truncates and reseeds shared tables** -> Mitigation: preserve current sequential ordering constraints and existing comments until a broader isolation redesign is done.

## Migration Plan

1. Add Testcontainers dev dependencies to `apps/api`.
2. Update `vitest.integration.config.ts` to use the container-backed global setup and existing worker setup file.
3. Refactor `test-global-setup.ts` to start PostgreSQL and Redis containers, write the dynamic environment handoff, run migrations, seed SRD data, and return teardown.
4. Update `test-setup.ts` to load the generated integration-test environment for each worker.
5. Replace hardcoded integration-test PostgreSQL and Redis URLs with `process.env.DATABASE_URL` and `process.env.REDIS_URL`.
6. Run `yarn test:integration` with Docker available.

Rollback is limited to the test harness: remove Testcontainers dependencies, restore localhost defaults in integration setup/specs, and return `test-global-setup.ts` to seeding against the externally provided database.

## Open Questions

- Which exact pgvector image tag should be pinned for Testcontainers? The implementation should pick a current stable tag that matches the project PostgreSQL version expectations.
