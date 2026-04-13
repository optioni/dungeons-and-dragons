## ADDED Requirements

### Requirement: NestJS application entry point
The `api/` workspace SHALL contain a NestJS application with `main.ts` bootstrapping `AppModule`. The app SHALL listen on the port defined by the `PORT` environment variable, defaulting to `3000`.

#### Scenario: App starts without errors
- **WHEN** `yarn workspace api dev` is run with valid environment variables
- **THEN** the NestJS app starts, logs its listening port, and accepts HTTP requests

### Requirement: GraphQL Yoga endpoint
`AppModule` SHALL register `YogaDriver` from `@graphql-yoga/nestjs` with `autoSchemaFile: true` (code-first). A placeholder `AppResolver` SHALL expose a `hello: String` query so the schema is non-empty at startup. The GraphQL endpoint SHALL be available at `/graphql`.

#### Scenario: GraphQL playground accessible
- **WHEN** a GET request is made to `/graphql`
- **THEN** the GraphQL Yoga UI (or schema introspection) responds with HTTP 200

#### Scenario: Placeholder query resolves
- **WHEN** the `hello` query is executed against `/graphql`
- **THEN** a string value is returned without error

### Requirement: Environment configuration with startup validation
`ConfigModule.forRoot({ isGlobal: true })` SHALL be registered in `AppModule`. All required environment variables SHALL be validated at startup using a schema (class-validator or Zod). If any required variable is missing or invalid, the app SHALL exit with a descriptive error before accepting any connections.

#### Scenario: Missing required env var
- **WHEN** a required environment variable is absent and the app starts
- **THEN** the process exits with a non-zero code and logs which variable is missing

#### Scenario: Valid env vars
- **WHEN** all required environment variables are present and valid
- **THEN** the app starts without validation errors

### Requirement: MikroORM connected to PostgreSQL
`MikroOrmModule.forRootAsync(...)` SHALL be registered in `AppModule` using the `DATABASE_URL` environment variable. The connection SHALL be verified at startup. `@mikro-orm/postgresql` and `@mikro-orm/migrations` SHALL be installed. A `mikro-orm.config.ts` file SHALL exist at `api/` root, importable by the MikroORM CLI without the NestJS container (reads env vars via `dotenv/config`).

#### Scenario: Database connection on startup
- **WHEN** the app starts with a reachable PostgreSQL instance
- **THEN** MikroORM connects successfully and logs the connection

#### Scenario: MikroORM CLI usable
- **WHEN** `yarn mikro-orm migration:create` is run from `api/`
- **THEN** the CLI reads `mikro-orm.config.ts` and completes without DI container errors

### Requirement: Initial database migration with pgvector
An initial MikroORM migration SHALL exist that runs `CREATE EXTENSION IF NOT EXISTS vector;`. Running `yarn mikro-orm migration:up` SHALL apply this migration idempotently.

#### Scenario: Migration up on fresh database
- **WHEN** `yarn mikro-orm migration:up` is run against a fresh PostgreSQL database
- **THEN** the migration applies, pgvector extension is enabled, and the command exits with code 0

#### Scenario: Migration idempotent
- **WHEN** `yarn mikro-orm migration:up` is run a second time
- **THEN** no migration is applied and the command exits with code 0

### Requirement: BullMQ connected to Redis
`BullModule.forRootAsync(...)` SHALL be registered in `AppModule` using the `REDIS_URL` environment variable. No queues are defined in this change — only the root BullMQ connection.

#### Scenario: Redis connection on startup
- **WHEN** the app starts with a reachable Redis instance
- **THEN** BullMQ connects to Redis without error

### Requirement: API environment variable documentation
`api/.env.example` SHALL list every environment variable the API reads, with inline comments describing each variable's purpose and expected format. All variables SHALL have example values or placeholders.

#### Scenario: .env.example is complete
- **WHEN** `api/.env.example` is copied to `api/.env` and all placeholder values are filled in
- **THEN** the app starts without any missing-variable validation errors

### Requirement: Vitest test suite
`api/` SHALL have Vitest configured. An empty test suite (or a single placeholder test) SHALL exist and pass. The `yarn workspace api test` script SHALL run Vitest.

#### Scenario: Empty suite passes
- **WHEN** `yarn workspace api test` is run
- **THEN** Vitest exits with code 0
