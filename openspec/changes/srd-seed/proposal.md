## Why

The game engine needs structured D&D 5e reference data (spells, monsters, classes, races, equipment, conditions) to resolve mechanics at runtime. This data is read-only and must exist before any gameplay features can function. Seeding from the public dnd5eapi.co on first migration avoids bundling large JSON files and keeps the data canonical.

## What Changes

- SRD MikroORM entities: `SrdClass`, `SrdRace`, `SrdSpell`, `SrdMonster`, `SrdEquipment`, `SrdCondition`
- MikroORM seeder that fetches from `dnd5eapi.co` REST API and populates all SRD tables
- Seeder runs automatically on first migration (`mikro-orm migration:up`)
- Entities are read-only — no mutations exposed
- GraphQL queries for SRD data (used by character creation and game engine)

## Capabilities

### New Capabilities
- `srd-data`: Read-only SRD reference entities, seeder, and GraphQL queries. Foundation for character creation, game engine mechanics, and item system.

### Modified Capabilities

## Impact

- New SRD entities and seeder in `api/`
- `character-system`, `game-engine`, and `campaign-setup` all depend on SRD data existing
- Migration must run with internet access on first setup (or seed from bundled JSON fallback)
