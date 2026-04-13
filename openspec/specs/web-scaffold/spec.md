## Purpose

The web scaffold establishes the Nuxt 3 frontend workspace with Nuxt UI v4, urql GraphQL client (with SSE subscription support), environment variable documentation, and a Vitest test suite.

## Requirements

### Requirement: Nuxt 3 application
The `web/` workspace SHALL contain a Nuxt 3 application scaffolded via `nuxi init`. The app SHALL start with `yarn workspace web dev` and serve on the port defined by `NUXT_PORT` (or Nuxt's default `3000`), configurable to avoid collision with the API port.

#### Scenario: Web app starts without errors
- **WHEN** `yarn workspace web dev` is run with valid environment variables
- **THEN** the Nuxt dev server starts and the default page is accessible in a browser

### Requirement: Nuxt UI v4 installed and configured
`@nuxt/ui` SHALL be listed in `nuxt.config.ts` modules. The module SHALL be importable and render without errors on the default page.

#### Scenario: Nuxt UI module loads
- **WHEN** the Nuxt dev server starts
- **THEN** the `@nuxt/ui` module initializes without console errors

### Requirement: urql GraphQL client configured
urql SHALL be configured as a Nuxt plugin (`plugins/urql.client.ts`) with:
- The API URL read from Nuxt runtime config (`NUXT_PUBLIC_API_URL`)
- A `fetchExchange` for queries and mutations
- A `subscriptionExchange` wired to `graphql-sse`'s `createClient` for SSE-based subscriptions

The `useQuery`, `useMutation`, and `useSubscription` composables SHALL be available app-wide via the plugin.

#### Scenario: urql client initializes
- **WHEN** the Nuxt app loads in the browser
- **THEN** the urql client is initialized with the correct API URL and no console errors appear

#### Scenario: Subscription exchange configured
- **WHEN** the Nuxt app loads
- **THEN** the urql client has a subscriptionExchange configured (verifiable via client config inspection in tests)

### Requirement: Web environment variable documentation
`web/.env.example` SHALL list every environment variable the web app reads, with inline comments. All variables SHALL have example values or placeholders.

#### Scenario: .env.example is complete
- **WHEN** `web/.env.example` is copied to `web/.env` and placeholders are filled in
- **THEN** the Nuxt app starts without any missing runtime config warnings

### Requirement: Web test suite
`web/` SHALL have a test runner configured (Vitest via `@nuxt/test-utils` or standalone). A placeholder test SHALL exist and pass. The `yarn workspace web test` script SHALL run the test suite.

#### Scenario: Placeholder test passes
- **WHEN** `yarn workspace web test` is run
- **THEN** the test runner exits with code 0
