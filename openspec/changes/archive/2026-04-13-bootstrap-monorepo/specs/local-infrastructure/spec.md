## ADDED Requirements

### Requirement: Docker Compose with PostgreSQL (pgvector-enabled)
A `docker-compose.yml` SHALL exist at the repository root. It SHALL define a `postgres` service using a pgvector-enabled image (e.g. `pgvector/pgvector:pg17`) pinned to a specific tag. The service SHALL expose PostgreSQL on port `5432` and persist data via a named volume. The image tag SHALL be documented with a comment indicating the pinned version and how to upgrade.

#### Scenario: Postgres service starts
- **WHEN** `docker compose up -d` is run
- **THEN** the postgres container starts, is healthy, and accepts connections on port 5432

#### Scenario: pgvector extension available
- **WHEN** connected to the running Postgres container
- **THEN** `CREATE EXTENSION IF NOT EXISTS vector;` executes without error

### Requirement: Docker Compose with Redis
The `docker-compose.yml` SHALL define a `redis` service using `redis:7-alpine` (or latest stable minor, pinned). The service SHALL expose Redis on port `6379` and persist data via a named volume.

#### Scenario: Redis service starts
- **WHEN** `docker compose up -d` is run
- **THEN** the redis container starts and accepts connections on port 6379

### Requirement: Setup documentation
The `docker-compose.yml` SHALL include header comments documenting the one-command setup (`docker compose up -d`) and referencing the `.env.example` files for required environment variable values. A brief note on the pgvector image tag and upgrade path SHALL be included.

#### Scenario: Developer can set up from scratch
- **WHEN** a developer follows only the comments in `docker-compose.yml` and copies both `.env.example` files
- **THEN** they can bring up all local infrastructure and start both apps without additional documentation
