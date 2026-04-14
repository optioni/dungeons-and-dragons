## 1. API — Dependencies and Module Scaffold

- [x] 1.1 Install `bcryptjs` and `@types/bcryptjs` in `apps/api/`
- [x] 1.2 Verify `@nestjs/jwt` is installed in `apps/api/` (passport not needed — guard handles JWT directly)
- [x] 1.3 Create `apps/api/src/auth/` with `auth.module.ts`, `auth.service.ts`, `auth.resolver.ts`

## 2. API — User Entity and Migration

- [x] 2.1 Write a failing test: `User` entity can be persisted with `email`, `passwordHash`, and `createdAt`
- [x] 2.2 Create `apps/api/src/auth/entities/user.entity.ts` with UUID primary key, unique email, passwordHash, createdAt
- [x] 2.3 Update the import in `graphql/decorators/current-user.decorator.ts` to point to the actual `User` entity path
- [x] 2.4 Run `yarn mikro-orm migration:create` to generate the `user` table migration
- [x] 2.5 Run `yarn mikro-orm migration:up` and verify the table exists

## 3. API — Auth Service (Registration and Login)

- [x] 3.1 Write failing tests: `register` hashes password and persists user; `login` returns token on valid credentials; `login` returns error on invalid credentials
- [x] 3.2 Implement `AuthService.register` — validate email uniqueness, hash password with bcryptjs (cost 12), persist user, return signed JWT
- [x] 3.3 Implement `AuthService.login` — find user by email, compare password with bcrypt, return signed JWT (7-day expiry) or throw UnauthorizedException
- [x] 3.4 Configure `JwtModule` in `AuthModule` with secret from `@nestjs/config` and `expiresIn: '7d'`

## 4. API — GraphQL Resolver

- [x] 4.1 Write failing tests: `register` mutation returns token; `login` mutation returns token; duplicate email returns error
- [x] 4.2 Create `RegisterInput` and `LoginInput` DTOs with class-validator decorators (email format, min password length 8)
- [x] 4.3 Create `AuthPayload` object type with `accessToken: string`
- [x] 4.4 Implement `AuthResolver` with `register` and `login` mutations, both decorated with `@Public()` (imported from `graphql/decorators/public.decorator.ts`)

## 5. API — Adapt AuthGuard and Wire GraphQL Context

- [x] 5.1 Write failing test: protected resolver returns UNAUTHORIZED when no JWT cookie present; public resolver executes without cookie
- [x] 5.2 Remove Auth0 remnants: delete `payload/auth0.payload.ts`, `decorators/user.decorator.ts`, `decorators/permissions.decorator.ts`, `middleware/permission.middleware.ts`
- [x] 5.3 Add local JWT payload type `JwtPayload` (`{ sub: string }`) to `graphql/payload/jwt.payload.ts`
- [x] 5.4 Adapt `AuthGuard` to extract JWT from the `cookie` header (or `Authorization` bearer), verify via `JwtService`, fetch the `User` entity from DB, and set it as `req.dbUser` — throw `UnauthorizedException` if missing or invalid
- [x] 5.5 Update `GraphQLModule.forRoot()` context factory in `AppModule` to expose `req.dbUser` as `dbUser` in the GQL context (required by the existing `@CurrentUser()` decorator)
- [x] 5.6 Import `GraphqlModule` in `AppModule` (it already registers `AuthGuard` as `APP_GUARD` — no duplicate needed)

## 6. API — Cookie and CORS Setup

- [x] 6.1 Install `cookie-parser` and `@types/cookie-parser` in `apps/api/` and register in `main.ts`
- [x] 6.2 Configure CORS in `main.ts` with `credentials: true` and `origin` from env (`WEB_ORIGIN`)
- [x] 6.3 Set the JWT as an httpOnly, SameSite=Strict cookie on the response in `AuthResolver` (use Yoga's `@Context()` to access the raw response object)
- [x] 6.4 Add `WEB_ORIGIN` and `JWT_SECRET` to `apps/api/.env.example`

## 7. API — Integration Tests

- [x] 7.1 Write integration test: full register → login flow against real PostgreSQL (using MikroORM test transaction rollback)
- [x] 7.2 Write integration test: protected resolver rejects unauthenticated request; accepts request with valid JWT cookie

## 8. Web — urql Client Configuration

- [x] 8.1 Configure urql client in `apps/web/` with `credentials: 'include'` on the fetch exchange
- [x] 8.2 Add auth exchange to urql client that detects `extensions.code === 'UNAUTHORIZED'` and redirects to `/auth`

## 9. Web — Auth Page

- [x] 9.1 Create `apps/web/pages/auth.vue` with login and registration form sections using Nuxt UI components
- [x] 9.2 Implement registration form: email, password, password confirmation fields; client-side validation for password match
- [x] 9.3 Implement login form: email and password fields; inline error display on mutation failure
- [x] 9.4 Wire `register` GraphQL mutation to registration form; on success redirect to `/`
- [x] 9.5 Wire `login` GraphQL mutation to login form; on success redirect to `/`

## 10. Web — Auth Middleware

- [x] 10.1 Create Nuxt route middleware that checks for the auth cookie and redirects authenticated users away from `/auth` to `/`
- [x] 10.2 Create Nuxt route middleware that redirects unauthenticated users away from all non-auth pages to `/auth`
