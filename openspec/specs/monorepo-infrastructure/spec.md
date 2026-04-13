## Purpose

The monorepo infrastructure establishes Yarn 4 workspaces, shared Prettier and ESLint configurations, and root-level convenience scripts for running lint, tests, and dev servers across all workspaces.

## Requirements

### Requirement: Yarn 4 workspace root
The root `package.json` SHALL declare Yarn 4 (Berry) as the package manager and list `api` and `web` as workspaces. The `.yarnrc.yml` SHALL set `nodeLinker: node-modules`. Both `yarn.lock` and `.yarn/releases/` SHALL be committed to the repository.

#### Scenario: Install from clean checkout
- **WHEN** a developer runs `yarn install` on a clean checkout
- **THEN** all workspace dependencies are installed under `node_modules/` in each workspace without PnP errors

#### Scenario: Workspace script delegation
- **WHEN** a developer runs `yarn workspace api <script>` or `yarn workspace web <script>`
- **THEN** the script executes in the correct workspace context

### Requirement: Shared Prettier configuration
A single `prettier.config.js` SHALL exist at the repository root and SHALL be the only Prettier config in the repository. No workspace-level Prettier config files SHALL exist.

#### Scenario: Prettier resolves from workspace file
- **WHEN** Prettier is run on a file inside `api/` or `web/`
- **THEN** it resolves and applies the root `prettier.config.js` config

### Requirement: Shared ESLint configuration
A root `eslint.config.js` SHALL use `@juuso.piikkila/eslint-config-typescript` as the base. Each workspace SHALL have its own `eslint.config.js` extending the root config. The `web/` workspace config SHALL apply the Vue-specific preset from `@juuso.piikkila/eslint-config-typescript`.

#### Scenario: API lint passes on scaffold
- **WHEN** `yarn workspace api lint` is run on the freshly scaffolded API
- **THEN** lint exits with code 0 and reports no errors

#### Scenario: Web lint passes on scaffold
- **WHEN** `yarn workspace web lint` is run on the freshly scaffolded web app
- **THEN** lint exits with code 0 and reports no errors

### Requirement: Root-level scripts
The root `package.json` SHALL include convenience scripts: `lint` (runs lint in all workspaces), `test` (runs tests in all workspaces), and `dev` (starts both `api` and `web` dev servers concurrently).

#### Scenario: Root dev script
- **WHEN** `yarn dev` is run at the repository root
- **THEN** both the API and web dev servers start concurrently
