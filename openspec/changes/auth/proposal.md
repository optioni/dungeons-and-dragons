## Why

The app is designed for multiple users. Before any game features can be built, users need to be able to register, log in, and have their data scoped to their account. JWT auth is required by every protected resolver.

## What Changes

- `User` MikroORM entity — id, email, passwordHash, createdAt
- Registration and login GraphQL mutations returning a JWT access token
- Password hashing with bcrypt
- `JwtAuthGuard` applied globally across all protected resolvers
- `CurrentUser` decorator for extracting user from request context
- `/auth` page in web — login and registration forms, stores JWT in cookie/localStorage, redirects to dashboard on success

## Capabilities

### New Capabilities
- `user-auth`: User registration, login, JWT issuance, and guard infrastructure used by all protected resolvers
- `auth-ui`: `/auth` web page with login and registration forms, JWT storage, redirect flow

### Modified Capabilities

## Impact

- New `AuthModule` in `api/`
- All subsequent modules depend on `JwtAuthGuard` and `CurrentUser` decorator from this change
- urql client configured with auth exchange to attach JWT to all requests
