## ADDED Requirements

### Requirement: Integration tests use containerized infrastructure
The API integration test command SHALL start ephemeral PostgreSQL and Redis containers for the duration of each integration test run. The PostgreSQL container SHALL use a pgvector-capable image so migrations that create the `vector` extension and vector columns can run successfully.

#### Scenario: Integration test infrastructure starts
- **WHEN** `yarn test:integration` is run from `apps/api` with Docker available
- **THEN** the test harness starts PostgreSQL and Redis containers before integration specs execute

#### Scenario: pgvector is available in the test database
- **WHEN** the integration test harness runs database migrations against the containerized PostgreSQL database
- **THEN** migrations that execute `CREATE EXTENSION IF NOT EXISTS vector;` and create vector columns complete without pgvector-related errors

### Requirement: Integration setup prepares database state
The integration test global setup SHALL run MikroORM migrations once against the containerized PostgreSQL database before any integration spec file runs. After migrations complete, the setup SHALL seed SRD reference data once so specs that depend on SRD classes, races, spells, monsters, equipment, or conditions can execute without external preparation.

#### Scenario: Migrations run before specs
- **WHEN** an integration spec opens a MikroORM connection during `yarn test:integration`
- **THEN** the schema created by all pending MikroORM migrations is already present in the containerized test database

#### Scenario: SRD data is seeded before specs
- **WHEN** an integration spec queries SRD reference tables during `yarn test:integration`
- **THEN** SRD rows are available without requiring a developer to run a separate seed command

### Requirement: Integration specs receive dynamic service URLs
The integration test harness SHALL provide the containerized PostgreSQL and Redis connection URLs to all integration test workers through `DATABASE_URL` and `REDIS_URL`. Integration specs SHALL use those environment variables instead of hardcoded localhost connection strings.

#### Scenario: Database URL is provided to workers
- **WHEN** an integration spec creates a MikroORM connection
- **THEN** it uses the `DATABASE_URL` value produced by the integration test harness

#### Scenario: Redis URL is provided to workers
- **WHEN** an integration spec creates a Redis client
- **THEN** it uses the `REDIS_URL` value produced by the integration test harness

#### Scenario: Localhost services are not required
- **WHEN** no PostgreSQL or Redis service is listening on localhost default ports
- **THEN** `yarn test:integration` can still run using the Testcontainers-managed services

### Requirement: Integration infrastructure is scoped to integration tests
The Testcontainers-backed infrastructure SHALL be used only by the API integration test command. API unit tests and application runtime startup SHALL continue to use their existing configuration paths and SHALL NOT require Docker.

#### Scenario: Unit tests do not start containers
- **WHEN** `yarn test` is run from `apps/api`
- **THEN** Testcontainers infrastructure is not started and Docker is not required

#### Scenario: Application runtime config remains unchanged
- **WHEN** the API application starts outside the integration test command
- **THEN** it reads `DATABASE_URL` and `REDIS_URL` from the normal runtime environment

### Requirement: Integration tests keep shared sequential execution
The integration test suite SHALL continue to run integration spec files sequentially against one shared PostgreSQL container and one shared Redis container for the whole test run. This phase SHALL preserve the existing shared seeded database model and existing per-spec cleanup responsibilities.

#### Scenario: Integration files run sequentially
- **WHEN** `yarn test:integration` runs multiple integration spec files
- **THEN** Vitest does not execute those spec files in parallel

#### Scenario: Shared containers are reused for the run
- **WHEN** multiple integration spec files execute in one `yarn test:integration` run
- **THEN** they use the same PostgreSQL and Redis containers for that run

### Requirement: Integration containers are cleaned up after the run
The integration test harness SHALL stop the PostgreSQL and Redis containers after the integration test run completes or fails. Any generated temporary environment handoff file used to propagate dynamic service URLs SHALL also be removed during teardown.

#### Scenario: Containers stop after successful run
- **WHEN** `yarn test:integration` completes successfully
- **THEN** the harness stops the PostgreSQL and Redis containers it started

#### Scenario: Containers stop after failed run
- **WHEN** `yarn test:integration` exits because an integration spec fails
- **THEN** the harness still stops the PostgreSQL and Redis containers it started
