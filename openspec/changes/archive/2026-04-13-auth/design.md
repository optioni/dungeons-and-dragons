## Context

The app is a single-player D&D experience with a NestJS/GraphQL API and Nuxt 3 frontend. No auth exists yet. Every subsequent module (Character, Campaign, Session, etc.) depends on knowing which user is making a request, so auth is the foundational change that must land first.

Current state: the API has no `User` entity, no guards, and no JWT infrastructure. The web has no login or registration pages. All resolvers are effectively unauthenticated.

## Goals / Non-Goals

**Goals:**
- `User` entity with email + bcrypt-hashed password persisted via MikroORM
- `register` and `login` GraphQL mutations that return a signed JWT access token
- `JwtAuthGuard` applied globally; resolvers that don't require auth (register, login) are decorated with `@Public()`
- `@CurrentUser()` decorator that extracts the authenticated user from the GraphQL execution context
- `/auth` page in Nuxt with login and registration forms; JWT stored in an httpOnly cookie; redirect to dashboard on success
- urql configured with an auth exchange that attaches the JWT to every request

**Non-Goals:**
- Refresh tokens or sliding sessions (single access token only for now)
- OAuth / social login
- Email verification or password reset flows
- Role-based access control (all authenticated users have the same permissions)
- Rate limiting on auth endpoints

## Decisions

### JWT storage: httpOnly cookie (not localStorage)

**Decision:** Store the JWT in an httpOnly, SameSite=Strict cookie set by the API response, not in localStorage or a JS-accessible cookie.

**Rationale:** httpOnly cookies are invisible to JavaScript and therefore immune to XSS. GraphQL over HTTP works fine with cookies; urql's fetch exchange sends cookies automatically when `credentials: 'include'` is set. localStorage is simpler but exposes the token to any injected script.

**Alternative considered:** `localStorage` — easier to implement, no CORS credential config needed, but leaves the token accessible to XSS. Rejected.

**Alternative considered:** In-memory storage (JS variable) — XSS-safe but lost on page refresh. Rejected as too disruptive to UX.

### Global guard with `@Public()` opt-out

**Decision:** Register `JwtAuthGuard` as a global guard via `APP_GUARD`. Resolvers/controllers that should be publicly accessible (register, login) are decorated with a custom `@Public()` metadata decorator that the guard checks before verifying the token.

**Rationale:** Opt-out is safer than opt-in — new resolvers are protected by default. A forgotten `@UseGuards()` can never accidentally expose a protected resolver.

**Alternative considered:** Opt-in `@UseGuards(JwtAuthGuard)` per resolver — simpler per-resolver, but any new resolver is silently unauthenticated until the guard is manually added. Rejected.

### GraphQL error format for auth failures

**Decision:** Throw NestJS `UnauthorizedException` from the guard. GraphQL Yoga converts this to a standard GraphQL error with `extensions.code: 'UNAUTHORIZED'` and HTTP 401.

**Rationale:** Consistent with NestJS conventions. The urql auth exchange on the frontend can inspect `extensions.code` to trigger a redirect to `/auth`.

### Password hashing: bcrypt with cost factor 12

**Decision:** Use `bcryptjs` (pure JS, no native bindings) with a cost factor of 12.

**Rationale:** Cost 12 is ~250ms on modern hardware — high enough to be meaningful against offline attacks, low enough for acceptable login latency. `bcryptjs` avoids native build complications in the development environment.

**Alternative considered:** `argon2` — stronger algorithm, but requires native bindings and adds setup friction. Not warranted for a single-player app. Rejected for now.

### JWT: access token only, 7-day expiry

**Decision:** Issue a single access token with a 7-day expiry. No refresh token.

**Rationale:** This is a solo-use app, not a high-security service. A 7-day token balances convenience (user stays logged in across sessions) against exposure window. Refresh token infrastructure adds significant complexity for minimal security gain in this context.

**Alternative considered:** Short-lived access + refresh token pair — correct for production multi-user services, but over-engineered here. Can be added later if needed.

## Risks / Trade-offs

- **No token revocation** → If a JWT is compromised it is valid until expiry (7 days). Mitigation: acceptable risk for a personal app; can add a server-side denylist later if needed.
- **bcryptjs is slower than native bcrypt** → At cost 12 this is ~250–400ms. Mitigation: acceptable for auth endpoints that are hit infrequently; move to native `bcrypt` if this becomes a bottleneck.
- **httpOnly cookie requires `credentials: 'include'` on urql** → The API must set `Access-Control-Allow-Credentials: true` and a non-wildcard `Access-Control-Allow-Origin`. Mitigation: configure CORS in `main.ts` with the web origin from env.
- **Cookie cleared on browser data wipe** → User must log in again. Acceptable UX for this use case.

## Migration Plan

1. Add `User` entity and generate a MikroORM migration (`yarn mikro-orm migration:create`).
2. Run migration in dev (`yarn mikro-orm migration:up`).
3. Implement `AuthModule` (entity, service, resolver, guard, decorator, JWT config).
4. Configure global guard in `AppModule`.
5. Implement `/auth` page in Nuxt; configure urql with `credentials: 'include'` and auth exchange.
6. Verify E2E: register → login → cookie set → protected resolver reachable → unauthenticated resolver blocked.

Rollback: drop the `user` table via a down migration; remove the `AuthModule` from `AppModule`. No other modules depend on auth yet.

## Open Questions

- Should the API set the cookie domain explicitly, or rely on the browser default? (Relevant if API and web are on different subdomains in production.)
- What is the target deployment environment? (Affects CORS origin config and cookie `Secure` flag — should always be `true` in production over HTTPS.)
