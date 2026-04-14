# D&D Solo Adventure App

A single-player D&D 5e game where Claude acts as the Dungeon Master. The LLM handles narrative, NPC roleplay, and game mechanics via tool calling. The world is alive — NPCs pursue agendas, factions shift power, and events unfold independently of the player.

## Monorepo Structure

```
/
├── apps/
│   ├── api/    NestJS + GraphQL Yoga + MikroORM
│   └── web/    Nuxt 3 + Nuxt UI + urql
├── docs/
│   └── superpowers/specs/
└── openspec/
```

## Prerequisites

- Node.js 22+
- Yarn 4
- Docker (for PostgreSQL + Redis)

## Setup

**1. Start infrastructure**

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector) and Redis.

**2. Install dependencies**

```bash
yarn install
```

**3. Configure environment**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set your API keys:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `VOYAGE_API_KEY` — from [voyageai.com](https://www.voyageai.com)
- `JWT_SECRET` — generate with `openssl rand -hex 64`

**4. Run database migrations**

```bash
cd apps/api && yarn mikro-orm migration:up
```

SRD data (spells, monsters, classes, races, equipment, conditions) is seeded automatically on first migration.

## Development

```bash
yarn dev
```

Starts both the API (port 3000) and web (port 4000) with hot reload.

Or run them separately:

```bash
yarn workspace api dev
yarn workspace web dev
```

## Testing

```bash
# All tests
yarn test

# API unit tests only
cd apps/api && yarn test

# API integration tests (requires running PostgreSQL)
cd apps/api && yarn test:integration

# Web tests
cd apps/web && yarn test
```

## Linting

```bash
yarn lint
```

## Tech Stack

| Layer | Stack |
|---|---|
| API | NestJS, GraphQL Yoga, MikroORM, PostgreSQL, pgvector, Redis, BullMQ |
| AI | Anthropic SDK (Claude Sonnet + Haiku), Voyage AI embeddings |
| Web | Nuxt 3, Nuxt UI v4, urql |
| Auth | JWT + Passport |
