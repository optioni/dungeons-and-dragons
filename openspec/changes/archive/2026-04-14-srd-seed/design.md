## Context

The D&D 5e SRD data (spells, monsters, classes, races, equipment, conditions) is a prerequisite for nearly every gameplay feature: character creation requires class/race lists, the game engine needs spell and condition lookups, and the item system references equipment. Without this data, no gameplay features can function.

Currently the project has no SRD entities or seed mechanism. The goal is to introduce read-only MikroORM entities and a seeder that fetches from the public `dnd5eapi.co` REST API on first `migration:up`.

The migration run happens in a developer/deployment context with internet access. Data volume is moderate: ~12 classes, ~9 races, ~319 spells, ~334 monsters, ~237 equipment items, ~15 conditions.

## Goals / Non-Goals

**Goals:**
- Six read-only SRD entities with enough fields to support runtime mechanics and character creation
- MikroORM seeder that fetches from `dnd5eapi.co` and is idempotent (safe to re-run)
- GraphQL queries returning SRD data for character creation UI and game engine context assembly
- Seeder invoked automatically via MikroORM's `AfterMigrate` hook so `migration:up` is a one-step setup

**Non-Goals:**
- Full SRD data fidelity — only fields used by the game engine and UI are stored
- Offline / bundled JSON fallback (deferred; migration requires internet on first run)
- Mutations or admin management of SRD data
- Versioning or update strategy for SRD data beyond re-seeding

## Decisions

### Fetch strategy: list → detail per entity type

`dnd5eapi.co` returns paginated lists at `/api/<resource>` and full details at `/api/<resource>/<index>`. The seeder will:
1. GET the list endpoint to collect all index slugs
2. Batch-fetch detail pages with a concurrency cap (e.g. 10 in-flight requests) to avoid hammering the API
3. Map each response to the entity shape and upsert via MikroORM

**Why not bulk JSON export?** The API response schema is authoritative and avoids bundling stale files. The public API has no auth requirement and is stable.

**Why concurrency cap?** dnd5eapi.co is a free service; uncapped fetches could trigger rate limits. 10 concurrent requests keeps wall-clock time under ~30s for the largest collections while being respectful.

### Idempotency via count check

Before fetching, the seeder checks `SELECT COUNT(*) FROM srd_spell` (and equivalent for each entity). If count > 0, that entity type is skipped. This makes re-running `migration:up` safe and fast.

**Alternative considered: upsert every run.** Rejected — would issue ~900+ upsert queries on every migration run even when data already exists, adding noticeable latency to deployments.

### Entity field selection: mechanics-first, not full SRD

Each entity stores only the fields the game engine and UI actually need:

| Entity | Key fields retained |
|---|---|
| SrdClass | index, name, hitDie, proficiencies (JSON), savingThrows (JSON), spellcastingAbility |
| SrdRace | index, name, speed, abilityBonuses (JSON), traits (JSON), size |
| SrdSpell | index, name, level, school, castingTime, range, components, duration, description, classes (JSON) |
| SrdMonster | index, name, size, type, alignment, ac, hp, cr, speed (JSON), abilities (JSON), actions (JSON) |
| SrdEquipment | index, name, category, cost (JSON), weight, properties (JSON), damage (JSON) |
| SrdCondition | index, name, description |

Complex nested structures (damage resistances, multi-attack details) are stored as JSONB columns to avoid over-normalisation of read-only reference data.

**Why JSONB for nested arrays?** These are read-only lookup tables, not queryable relational data. JSONB keeps the schema flat and avoids 15+ join tables that would only ever be read together.

### GraphQL: query-only, no subscriptions

Expose each SRD type via a `srd<Type>` root query (e.g. `srdSpells`, `srdClasses`). Filtering by index slug is the primary access pattern (e.g. `srdSpell(index: "fireball")`). List queries support an optional `search` argument for fuzzy name matching (used by character creation UI dropdowns).

No subscriptions — SRD data is static.

### Seeder invocation: MikroORM `Seeder` run via migration

MikroORM supports a `seeder` config key pointing to a `DatabaseSeeder` class. The seeder is called by adding a `runSeeder` call inside the final migration file, or by using `mikro-orm seeder:run` as a post-migration step. We'll use a dedicated migration step (`Migration20260413000001`) that calls `em.getRepository(SrdClass).count()` and delegates to the seeder, keeping the seeder logic separate from the migration SQL.

**Alternative: AfterMigrate hook.** Not chosen — NestJS lifecycle hooks don't fire cleanly during `mikro-orm migration:up` in CLI context. An explicit migration step is more predictable.

## Risks / Trade-offs

- **dnd5eapi.co unavailability** → First-time setup fails silently or noisily. Mitigation: seeder logs a clear error with instructions to re-run. The migration itself succeeds (schema is created); only SRD rows are missing.
- **API response shape changes** → Seeder mapping breaks on future dnd5eapi.co updates. Mitigation: seeder validates required fields before insert and logs warnings for unrecognised shapes rather than crashing.
- **Large monster `actions` JSONB** → Some monster entries have verbose action descriptions that bloat storage. Acceptable trade-off given volume (~334 rows).
- **Re-seeding after schema change** → If an SRD entity gains a new column, the count-check idempotency guard will skip re-fetching. Mitigation: document that `DELETE FROM srd_*` tables triggers a re-seed on next `migration:up`.

## Migration Plan

1. Add six SRD entity files under `api/src/srd/`
2. Add `SrdSeeder` class that orchestrates all six fetches
3. Add `Migration20260413000001` which runs the seeder (skipped if rows exist)
4. Register SRD entities in `MikroORM` config
5. Expose GraphQL resolvers in a new `SrdModule`
6. Register `SrdModule` in `AppModule`

Rollback: drop SRD tables (schema only — no app data lost) and remove the module from `AppModule`.

## Open Questions

- Should `SrdSpell` store the full description text or just a summary? Full text allows the DM LLM to include accurate spell wording in context without a separate lookup.
- Do we need `SrdWeaponProperty` as a separate entity or is JSONB on `SrdEquipment` sufficient? (Current proposal: JSONB.)
