## Why

The world needs to move without the player. NPCs pursue agendas, factions shift power, catastrophes strike, and events resolve — whether or not the player is involved. This living world is what makes the game feel real. The world tick, triggered by `take_long_rest`, processes all of this via batched Haiku calls and BullMQ.

## What Changes

- `QueueModule` — BullMQ world tick queue, Redis lock (`campaignLocked`) during tick, Redis-backed SRD cache
- World tick worker — diary write (via MemoryModule) → batch NPC agenda Haiku calls → NPC conversation pairs (2 turns max) → apply all outcomes → random catastrophe roll
- NPC agenda processing: lazy evaluation via `nextTickInGameDate`, batching of non-interacting NPCs, targeted context per NPC
- NPC conversations: identify pairs by location + NpcRelationship, run structured 2-turn Haiku dialogue, extract outcomes
- `trigger_catastrophe` tool — low-probability random world event generation

## Capabilities

### New Capabilities
- `world-tick`: BullMQ job, NPC agenda processing (batched Haiku), NPC conversations, outcome application, Redis lock
- `npc-agendas`: Lazy evaluation, per-NPC targeted context, agenda advancement and consequence generation, NPC movement (agenda outcomes can update `currentLocationId` — discoverable by other NPCs and the player)
- `npc-conversations`: Relationship-driven pair detection, structured 2-turn Haiku dialogue, outcome extraction
- `catastrophe-system`: Low-probability random catastrophic WorldEvent generation during world tick

### Modified Capabilities
- `game-session`: `take_long_rest` now enqueues world tick job via QueueModule
- `world-entities`: WorldEvent gains `CATASTROPHE` source type

## Impact

- New `QueueModule` in `api/`; `WorldModule` gains world tick worker
- Depends on `memory-system`, `game-engine`, `campaign-setup`
- Requires Redis running (already in docker-compose from bootstrap)
- Most expensive background process in the system — Haiku model used throughout
