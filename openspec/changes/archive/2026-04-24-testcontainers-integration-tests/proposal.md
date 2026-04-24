## Why

API integration tests currently depend on developer-local PostgreSQL and Redis instances at fixed localhost ports. This makes the suite fragile across machines and CI because pgvector, migrations, Redis availability, and seeded SRD state must already be prepared outside the test command.

## What Changes

- Add a shared Testcontainers-backed integration-test harness for `apps/api`.
- Start one PostgreSQL container with pgvector support for each integration test run.
- Start one Redis container for each integration test run.
- Expose dynamic `DATABASE_URL` and `REDIS_URL` values to all integration test workers.
- Run MikroORM migrations once during integration test setup before specs execute.
- Seed SRD reference data once during integration test setup after migrations.
- Update API integration specs to read test database and Redis URLs from the harness-provided environment instead of hardcoded localhost defaults.
- Keep the current sequential integration test execution and shared seeded database model for this phase.

## Capabilities

### New Capabilities

- `integration-test-infrastructure`: Defines the API integration test harness for containerized PostgreSQL, pgvector, Redis, migrations, SRD seeding, and test environment propagation.

### Modified Capabilities

- None.

## Impact

- Affects `apps/api` integration test configuration, global test setup, and integration specs.
- Adds Testcontainers-related development dependencies for PostgreSQL and Redis test infrastructure.
- Requires Docker to be available when running `yarn test:integration`.
- Does not change production runtime behavior, public GraphQL APIs, database schema, or application feature requirements.
