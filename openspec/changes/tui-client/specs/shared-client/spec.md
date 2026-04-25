## ADDED Requirements

### Requirement: Shared client package provides a GraphQL SSE client factory
The system SHALL expose a `packages/client/` workspace package containing a `createGraphQLClient(options)` factory that returns a configured SSE-capable GraphQL client. Both `apps/web/` and `apps/tui/` SHALL consume this factory instead of defining their own transport setup.

#### Scenario: Web app uses the shared client factory
- **WHEN** the web app initializes its urql plugin
- **THEN** it imports and calls `createGraphQLClient` from `packages/client/` to obtain the configured client instance

#### Scenario: TUI app uses the shared client factory
- **WHEN** the TUI app initializes its GraphQL transport
- **THEN** it imports and calls `createGraphQLClient` from `packages/client/` to obtain the configured client instance

### Requirement: Shared client package exposes generated GraphQL types
The system SHALL maintain a single `codegen.ts` (or `codegen.yml`) configuration in `packages/client/` that generates TypeScript types from the API schema. Both `apps/web/` and `apps/tui/` SHALL import GraphQL operation types from `packages/client/` rather than maintaining separate codegen outputs.

#### Scenario: Codegen output is consumed by both apps
- **WHEN** either the web or TUI app imports a GraphQL operation type
- **THEN** the import resolves to the generated file in `packages/client/` rather than a local codegen artifact

#### Scenario: Schema change triggers a single codegen run
- **WHEN** the API GraphQL schema changes and codegen is run
- **THEN** a single codegen run in `packages/client/` updates types used by both apps

### Requirement: Shared client package handles auth token management
The system SHALL provide token storage and retrieval utilities in `packages/client/` that abstract over environment-specific storage (localStorage for web, filesystem or environment variable for TUI). Both apps SHALL use these utilities for attaching JWT tokens to outbound requests.

#### Scenario: Web app stores and retrieves auth token via shared utility
- **WHEN** the web app authenticates a user
- **THEN** it stores the JWT using the shared token utility and the GraphQL client attaches it to subsequent requests

#### Scenario: TUI app stores and retrieves auth token via shared utility
- **WHEN** the TUI app authenticates a user
- **THEN** it stores the JWT using the shared token utility appropriate for Node.js and the client attaches it to subsequent requests

### Requirement: SSE client implements exponential backoff reconnection
The shared client factory SHALL configure automatic reconnection with exponential backoff for SSE subscriptions. The client SHALL expose a connection state observable so consuming apps can surface a reconnecting indicator to the user.

#### Scenario: SSE connection drop triggers backoff reconnection
- **WHEN** the SSE connection is lost
- **THEN** the client waits an exponentially increasing delay before each reconnect attempt up to a configurable maximum

#### Scenario: Connection state is observable by the consuming app
- **WHEN** the SSE connection state changes (connected, reconnecting, failed)
- **THEN** the consuming app can subscribe to a state signal from the shared client and update its UI accordingly
