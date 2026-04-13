## Why

Before the first session can begin, a campaign needs to be created and the world seeded. The player chooses a tone and selects from LLM-generated story concepts, then the LLM generates the initial world: locations, factions, key NPCs, the main antagonist, and an opening scene. This world seed is persisted to the database before the first game session starts.

## What Changes

- `Campaign` entity — name, inGameDate, currentLocationId, loreDocument, deathMode, createdAt
- `Location`, `Map`, `MapLocation`, `LocationDiscovery` entities
- `Faction` entity
- `Npc`, `NpcRelationship`, `NpcItem` entities
- `WorldEvent` entity
- Campaign creation flow: tone selection → LLM generates story concepts → player picks one → LLM generates world seed → all entities persisted
- Dashboard page (`/`) and campaign setup wizard (`/campaign/[id]/setup`)

## Capabilities

### New Capabilities
- `campaign-management`: Campaign entity, creation flow, dashboard
- `world-entities`: Location, Map, Faction, WorldEvent entities and their GraphQL queries
- `npc-entities`: Npc, NpcRelationship, NpcItem entities and their GraphQL queries
- `world-seed-generation`: LLM-driven world seed (story concepts, initial locations/factions/NPCs/antagonist) generated and persisted at campaign creation time

### Modified Capabilities

## Impact

- New `CampaignModule` and `WorldModule` (entities only, no world tick yet) in `api/`
- Depends on `auth`, `character-system`, `srd-data`
- `session-and-llm` and `world-system` depend on these entities existing
