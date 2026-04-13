## Why

The app is designed for multiple users. Before any game features can be built, users need to be able to register, log in, and have their data scoped to their account. JWT auth is required by every protected resolver.

## What Changes

- `User` MikroORM entity — id, email, passwordHash, createdAt
- Registration and login GraphQL mutations returning a JWT access token
- Password hashing with bcrypt
- `JwtAuthGuard` applied globally across all protected resolvers
- `CurrentUser` decorator for extracting user from request context

## Capabilities

### New Capabilities
- `user-auth`: User registration, login, JWT issuance, and guard infrastructure used by all protected resolvers

### Modified Capabilities

## Impact

- New `AuthModule` in `api/`
- All subsequent modules depend on `JwtAuthGuard` and `CurrentUser` decorator from this change
- No web UI — auth tokens are used directly by the Nuxt app via urql headers
