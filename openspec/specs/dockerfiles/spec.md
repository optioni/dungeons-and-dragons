## Purpose

Production Dockerfiles for the API and web workspaces, using multi-stage builds with dependency layer caching and pinned base images.

## Requirements

### Requirement: API production Dockerfile
`api/Dockerfile` SHALL use a multi-stage build. The `builder` stage SHALL install all dependencies (including devDependencies) and compile the NestJS app to `dist/`. The `runner` stage SHALL use a minimal Node LTS Alpine image, copy only `dist/` and production `node_modules`, and run as the non-root `node` user. The image SHALL accept all configuration exclusively via environment variables — no `.env` file SHALL be baked in.

#### Scenario: API image builds successfully
- **WHEN** `docker build -t dnd-api ./api` is run from the repo root
- **THEN** the build completes without error and produces an image

#### Scenario: API container starts with env vars
- **WHEN** the API image is run with all required environment variables injected
- **THEN** the NestJS app starts, connects to its dependencies, and serves `/graphql`

#### Scenario: API image runs as non-root
- **WHEN** the running API container's user is inspected
- **THEN** the process runs as the `node` user, not `root`

### Requirement: Web production Dockerfile
`web/Dockerfile` SHALL use a multi-stage build. The `builder` stage SHALL install dependencies and run `nuxi build` to produce the Nuxt output server bundle. The `runner` stage SHALL use a minimal Node LTS Alpine image, copy only the built output (`.output/`), and run as the non-root `node` user. The image SHALL accept configuration via environment variables at runtime — no `.env` file SHALL be baked in.

#### Scenario: Web image builds successfully
- **WHEN** `docker build -t dnd-web ./web` is run from the repo root
- **THEN** the build completes without error and produces an image

#### Scenario: Web container starts with env vars
- **WHEN** the web image is run with `NUXT_PUBLIC_API_URL` and `NUXT_PORT` injected
- **THEN** the Nuxt server starts and serves the default page

#### Scenario: Web image runs as non-root
- **WHEN** the running web container's user is inspected
- **THEN** the process runs as the `node` user, not `root`

### Requirement: Dependency layer caching
Both Dockerfiles SHALL copy `package.json`, `yarn.lock`, and `.yarnrc.yml` (and root workspace files) before running `yarn install`, so the dependency install layer is only invalidated when dependency files change — not on every source code change.

#### Scenario: Rebuild after source-only change is fast
- **WHEN** a source file is changed and the image is rebuilt
- **THEN** Docker uses the cached dependency layer and does not re-run `yarn install`

### Requirement: Pinned Node base image
Both Dockerfiles SHALL pin the Node base image to a specific LTS major version (e.g. `node:22-alpine`) with a comment noting the version and when to bump it. The tag SHALL NOT be `lts` or `latest`.

#### Scenario: Base image tag is explicit
- **WHEN** `api/Dockerfile` and `web/Dockerfile` are inspected
- **THEN** both `FROM` lines reference a pinned version tag, not `lts` or `latest`
