# D&D Solo Adventure App

A single-player D&D 5e game where Claude acts as the Dungeon Master. LLMs handle narrative, NPC roleplay, and game mechanics via tool calling. The world is alive — NPCs pursue agendas, factions shift power, and events unfold independently of the player.

## Monorepo Structure

```
/
├── api/          NestJS backend
├── web/          Nuxt 3 frontend
├── docs/
│   └── superpowers/
│       └── specs/   Design specs
└── openspec/     OpenSpec change proposals
```

## Tech Stack

### API (`api/`)
- **NestJS** with **GraphQL Yoga** (code-first schema, SSE-based subscriptions)
- **MikroORM** with **PostgreSQL** — entities, migrations, seeders
- **pgvector** — semantic memory search
- **Redis** + **BullMQ** (`@nestjs/bullmq`) — world tick job queue
- **Anthropic SDK** — Claude Sonnet for DM session, Claude Haiku for background processing
- **Voyage AI** — text embeddings for pgvector
- **@nestjs/jwt** + **passport** — JWT auth
- **@nestjs/config** — environment variables
- **Vitest** — unit and integration tests

### Web (`web/`)
- **Nuxt 3** with **Nuxt UI v4** components
- **urql** — GraphQL client (queries, mutations, SSE subscriptions)

### Tooling (monorepo-wide)
- **ESLint** with `@juuso.piikkila/eslint-config-typescript` (Vue config for web)
- **Prettier** — single `prettier.config.js` at root

## Key Architecture Decisions

- **GraphQL subscriptions over SSE** (not WebSocket) for LLM streaming
- **GraphQL relay pagination** with cursors for all list queries (Connection/Edge/PageInfo pattern)
- **Prompt caching** with 4 breakpoints: system prompt + active modules / campaign state / world state + diary / session history. Only the latest player input is ever uncached.
- **Claude Sonnet** for DM session stream; **Claude Haiku** for world tick, diary writing, NPC agenda processing
- **Model names are config values** — never hardcoded
- **World tick** runs as a BullMQ job triggered by `take_long_rest`. A Redis lock (`campaignLocked`) prevents race conditions while the tick runs.
- **Dynamic prompt modules** per scene type (COMBAT / SOCIAL / EXPLORATION / SETTLEMENT / REST) — loaded as stable text fragments, cached at breakpoint 1
- **Quest objectives** auto-complete via indexed `QuestObjective` queries after each state-changing tool call
- **Location discovery** derived from `LocationDiscovery` table — no `discovered` flag on Location
- **NPC agendas** processed in batched Haiku calls with lazy evaluation (`nextTickInGameDate` is an in-game date, not a real-time timestamp)
- **SRD data** (spells, monsters, classes, races, equipment, conditions) seeded from `dnd5eapi.co` on first migration — read-only, never modified at runtime

## Shared GraphQL Infrastructure (`apps/api/src/graphql/`)

Before implementing GraphQL types, resolvers, or guards, check this directory for existing utilities:

| Path | Contents |
|---|---|
| `relay/` | Relay pagination helpers — `ConnectionArgs`, `PageInfo`, `OrderByInput`, cursor validators |
| `decorators/` | `@CurrentUser()`, `@CurrentConnectionId()`, `@Public()` |
| `guards/` | `AuthGuard` — JWT authentication for resolvers |
| `scalars/` | `JsonScalar` — GraphQL JSON scalar |
| `where.service.ts` | `WhereService` — builds MikroORM `where` clauses from GraphQL filter inputs |

All list queries must use relay pagination types from `relay/`.

## NestJS Modules

| Module | Responsibility |
|---|---|
| AuthModule | JWT auth, user registration/login |
| CharacterModule | Character creation, sheet, leveling, skill proficiencies |
| CampaignModule | Campaign metadata, in-game date, lore document, antagonist stages |
| SessionModule | Active game sessions, player input, GameEvent log |
| GameEngineModule | D&D 5e mechanics via LLM tool calls — see tool list in spec |
| MemoryModule | Diary entries + memory facts with pgvector embeddings, 7-day rolling context |
| WorldModule | Locations, factions, world events, NPC agendas, world tick, NPC conversations |
| LLMModule | Claude orchestration, SSE streaming, context assembly, prompt caching, module loading |
| QueueModule | BullMQ world tick queue, Redis-backed SRD cache via CacheModule |

## LLM Tool Calls

All tool calls return structured results — errors are returned as structured responses so the LLM can recover gracefully in narrative ("the magic fizzles unexpectedly"). Never throw raw exceptions back to the LLM.

The full tool list lives in the design spec: `docs/superpowers/specs/2026-04-13-dnd-app-design.md`

## Development Conventions

- **Conventional commits** — `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- **TDD** — write the failing test first, then the minimal implementation
- **Single responsibility** — one clear purpose per file/module
- **YAGNI** — no speculative features or abstractions
- **No `any` types** — TypeScript strict mode
- **JSDoc required** — document all public classes, methods, and non-obvious logic

## Database

- Run migrations: `cd api && yarn mikro-orm migration:up`
- Create migration: `cd api && yarn mikro-orm migration:create`
- Seed SRD data: handled automatically on first migration via MikroORM seeders
- pgvector must be enabled on the PostgreSQL instance: `CREATE EXTENSION IF NOT EXISTS vector;`

## Testing

```bash
# API unit tests
cd api && yarn test

# API integration tests (requires real PostgreSQL + pgvector)
cd api && yarn test:integration

# API type checking
cd api && yarn typecheck

# Web type checking
cd web && yarn typecheck

# Web tests (if implemented)
cd web && yarn test
```

Integration tests use MikroORM test transactions — each test rolls back after completion. No test doubles for the database.

## Environment Variables

See `api/.env.example` and `web/.env.example` for required variables. Key ones:

```
# API
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...
JWT_SECRET=...
LLM_DM_MODEL=claude-sonnet-4-6
LLM_BACKGROUND_MODEL=claude-haiku-4-5-20251001
```

## Design Spec

Full design spec: `docs/superpowers/specs/2026-04-13-dnd-app-design.md`

Covers: all data models, module responsibilities, narrative design, memory system, world tick, prompt caching strategy, frontend layout, error handling, and testing approach.
