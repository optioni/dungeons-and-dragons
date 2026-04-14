## ADDED Requirements

### Requirement: User registration
The system SHALL allow a new user to register with a unique email address and a password. The password SHALL be hashed with bcrypt (cost factor 12) before storage. The system SHALL return a signed JWT access token on success.

#### Scenario: Successful registration
- **WHEN** a `register` mutation is called with a valid email and password (minimum 8 characters)
- **THEN** a `User` record is created with the email and bcrypt-hashed password, and a signed JWT is returned

#### Scenario: Duplicate email
- **WHEN** a `register` mutation is called with an email that already exists
- **THEN** the mutation returns a GraphQL error with a message indicating the email is already in use, and no new user is created

#### Scenario: Invalid email format
- **WHEN** a `register` mutation is called with a string that is not a valid email address
- **THEN** the mutation returns a validation error and no user is created

#### Scenario: Password too short
- **WHEN** a `register` mutation is called with a password shorter than 8 characters
- **THEN** the mutation returns a validation error and no user is created

### Requirement: User login
The system SHALL allow an existing user to authenticate with their email and password. On success the system SHALL return a signed JWT access token. The JWT SHALL expire after 7 days.

#### Scenario: Successful login
- **WHEN** a `login` mutation is called with a valid email and correct password
- **THEN** the system returns a signed JWT access token with a 7-day expiry

#### Scenario: Wrong password
- **WHEN** a `login` mutation is called with a valid email and an incorrect password
- **THEN** the mutation returns a GraphQL error with an "Invalid credentials" message; no token is issued

#### Scenario: Unknown email
- **WHEN** a `login` mutation is called with an email that does not exist in the database
- **THEN** the mutation returns a GraphQL error with an "Invalid credentials" message (same message as wrong password to prevent email enumeration)

### Requirement: JWT guard — global protection with public opt-out
The system SHALL apply `JwtAuthGuard` globally so that all GraphQL resolvers require a valid JWT by default. Resolvers decorated with `@Public()` SHALL be exempt from authentication checks.

#### Scenario: Authenticated request reaches protected resolver
- **WHEN** a GraphQL request includes a valid JWT (via cookie or Authorization header)
- **THEN** the resolver executes and the current user is available via `@CurrentUser()`

#### Scenario: Unauthenticated request to protected resolver
- **WHEN** a GraphQL request has no JWT or an expired/invalid JWT
- **THEN** the system returns a GraphQL error with `extensions.code: 'UNAUTHORIZED'` and HTTP status 401

#### Scenario: Public resolver accessible without token
- **WHEN** a GraphQL request targets a resolver decorated with `@Public()` (e.g., `register`, `login`)
- **THEN** the resolver executes without requiring a JWT

### Requirement: CurrentUser decorator
The system SHALL provide a `@CurrentUser()` parameter decorator that extracts the authenticated `User` from the GraphQL execution context and injects it into the resolver method.

#### Scenario: Current user injected into resolver
- **WHEN** a resolver parameter is decorated with `@CurrentUser()`
- **THEN** the parameter receives the `User` object corresponding to the JWT subject claim

### Requirement: User entity persistence
The system SHALL persist users in a `user` PostgreSQL table managed by MikroORM. The entity SHALL have: `id` (UUID primary key), `email` (unique, not null), `passwordHash` (not null), `createdAt` (timestamp, auto-set on insert).

#### Scenario: User created with correct fields
- **WHEN** a user successfully registers
- **THEN** a row exists in the `user` table with the correct email, a non-plaintext `passwordHash`, and a `createdAt` timestamp

#### Scenario: Email uniqueness enforced at database level
- **WHEN** two users attempt to register with the same email concurrently
- **THEN** only one succeeds; the database unique constraint prevents a duplicate row
