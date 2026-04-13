# D&D Solo Adventure App — Design Spec

**Date:** 2026-04-13

## Overview

A single-player D&D 5e experience where Claude acts as the Dungeon Master. The player manages their character and interacts with the world through a web frontend. All game mechanics are resolved server-side via LLM tool calls. The world is alive — NPCs pursue agendas, factions shift power, and events unfold whether the player acts or not.

Designed for multi-user from the start, but built for personal use initially.

---

## Tech Stack

**Monorepo structure:**
```
/
├── api/        NestJS + GraphQL Yoga + MikroORM
└── web/        Nuxt 3 + Nuxt UI + urql
```

**API:**
- NestJS with GraphQL Yoga (code-first schema)
- GraphQL subscriptions over SSE for LLM streaming
- MikroORM with PostgreSQL (entities, migrations, seeders)
- pgvector extension for semantic memory search
- Anthropic SDK for Claude integration
- Voyage AI SDK for text embeddings (pgvector storage)
- Redis + BullMQ (`@nestjs/bullmq`) for the world tick job queue

**Web:**
- Nuxt 3 with Nuxt UI components
- urql as the GraphQL client (queries, mutations, SSE subscriptions)

**LLM models:**
- Claude Sonnet — main DM session stream (narrative quality matters)
- Claude Haiku — world tick, NPC processing, diary writing, tool call resolution
- Model selection is a config value, not hardcoded

---

## API — Module Structure

Nine NestJS modules, each owning its domain:

### AuthModule
User registration, login, JWT access tokens. Standard guards applied across all protected resolvers.

### CharacterModule
Character creation (race, class, ability score assignment), character sheet, inventory management, leveling up. Reads SRD reference data for class progression tables, racial bonuses, equipment stats.

### CampaignModule
Campaign creation and metadata: name, in-game date, current location pointer. One character per campaign. Coordinates with WorldModule and MemoryModule but owns no world state itself.

### SessionModule
Active game sessions (one per sitting). Receives player input, assembles it for LLMModule, records all events to the GameEvent log. Manages session lifecycle (start, end, day transition trigger).

### GameEngineModule
D&D 5e mechanical resolution. Exposes functions that the LLM calls as tools:
- `roll_dice(expression)` — e.g. `"2d6+3"`
- `apply_damage(characterId, amount, type)`
- `heal(characterId, amount)`
- `use_spell_slot(characterId, level)`
- `apply_condition(characterId, condition)`
- `remove_condition(characterId, condition)`
- `check_ability(characterId, ability, dc)` — returns pass/fail
- `start_combat(participants)` / `end_combat(sessionId)`
- `advance_initiative(sessionId)`
- `advance_day(campaignId)` — triggers diary write + world tick

Reads SRD data for spell effects, monster stat blocks, condition rules.

### MemoryModule
The campaign's long-term memory system.

**Diary entries:** Written by Claude Haiku at the end of each in-game day. Summarises events, decisions, and consequences. Stored with a pgvector embedding (generated via Voyage AI embeddings API) and PostgreSQL `tsvector` for full-text search.

**Memory facts:** Discrete facts about characters and NPCs accumulated during play ("Theron owes a debt to the Thieves Guild", "Marta the innkeeper is secretly an informant"). Also stored with embeddings.

**Prompt injection:** Last 7 diary entries are automatically included in every DM prompt. Older entries are retrievable via LLM tool:
- `search_memories(query, subjectId?)` — semantic similarity search via pgvector across both diary entries and memory facts

**Day transition:** When the LLM calls the `advance_day` tool (signalling narrative time has passed), SessionModule triggers MemoryModule to write the diary entry (Haiku call) before the WorldModule world tick runs. The `advance_day` tool is the only mechanism for day transitions — the server never infers it automatically.

### WorldModule
The living world. Owns locations, factions, and ongoing events. Processes autonomous world change at the end of each in-game day.

**Entities:** Location, Faction, WorldEvent (see Data Models).

**World tick** (runs after each diary entry, at in-game day end):
1. Query all NPCs with active agendas where `nextTickAt <= now`
2. Batch simple NPCs into grouped Haiku calls; individual calls for NPCs with inter-NPC interactions
3. Each call receives: NPC profile, agenda, targeted world state (only what they'd plausibly know), recent relevant events
4. Outputs structured JSON: actions taken, state changes, new events to create
5. Identify NPC pairs in the same location with reason to interact; run short conversations (2 turns max, structured output, Haiku)
6. Apply all outcomes: create WorldEvents, update Location states, shift Faction dispositions, update NPC `nextTickAt`
7. Player may discover world tick outcomes naturally during play — a burned building, a changed NPC disposition, a rumour

**LLM tools for world state (called during DM session):**
- `update_location_state(locationId, state, note)`
- `shift_faction_disposition(factionId, delta, reason)`
- `trigger_world_event(description, locationId, deadlineInDays, source)`
- `resolve_world_event(eventId, outcome)`
- `update_npc(npcId, fields)` — disposition, location, alive, agenda

### QueueModule
BullMQ + Redis job queue. Currently owns one queue: `world-tick`. When `advance_day` fires, SessionModule enqueues a world tick job and returns immediately — the DM stream continues without blocking. The world tick worker processes the job: diary write → NPC agenda calls → NPC conversations → apply outcomes. Failed jobs are retried up to 3 times with exponential backoff before being moved to the dead-letter queue.

Since Redis is already running, it also serves as the store for NestJS `CacheModule` — used to cache SRD reference data (spells, monsters, classes) in-process so repeated game engine lookups don't hit PostgreSQL.

### LLMModule
Owns all Claude integration. Two operating modes:

**DM session mode (Sonnet):** Assembles context, streams response via SSE GraphQL subscription, intercepts tool calls mid-stream, resolves them via the appropriate module, continues streaming. One call per player turn.

**World tick mode (Haiku):** Batch structured calls with JSON output. No streaming. Parallel where NPC calls are independent.

**Context assembly order (DM session):**
1. System prompt — DM persona, world tone, D&D 5e rules summary, tool descriptions
2. Character state — HP, conditions, spell slots, inventory, ability scores
3. World state — current location description and state, active world events, relevant faction dispositions
4. Last 7 diary entries (from MemoryModule)
5. Current session GameEvents — everything that's happened this sitting
6. Player input

**Prompt caching strategy (4 cache breakpoints, ordered most → least stable):**

| Breakpoint | Content | Invalidates when |
|---|---|---|
| 1 | System prompt + tool definitions | Never (within a campaign) |
| 2 | Character state | Any tool call modifies character |
| 3 | World state + last 7 diary entries | `advance_day` fires |
| 4 | Historical session GameEvents (all but current turn) | Each new player turn |

In a typical turn only the latest player input and the new DM response are processed fresh — everything above breakpoint 4 is a cache hit. This keeps per-turn token costs minimal despite the large context window.

For Haiku world tick calls: cache the shared world state block that is passed identically to all NPC agenda calls in the same batch.

---

## Data Models

### Core entities

**User** — id, email, passwordHash, createdAt

**Character** — id, userId, name, race (ref SrdRace), class (ref SrdClass), level, abilityScores (JSON), hp, maxHp, ac, conditions (array), spellSlots (JSON by level), inventory (JSON), xp, proficiencyBonus

**Campaign** — id, userId, characterId, name, inGameDate, currentLocationId, createdAt

**GameSession** — id, campaignId, startedAt, endedAt

**GameEvent** — id, sessionId, type (PLAYER_INPUT | DM_NARRATIVE | TOOL_CALL | COMBAT_EVENT | SYSTEM), content, timestamp

**DiaryEntry** — id, campaignId, inGameDate, content, embedding (vector), createdAt

**Memory** — id, campaignId, subjectType (CHARACTER | NPC), subjectId, content, embedding (vector), createdAt

**Npc** — id, campaignId, name, description, disposition, currentLocationId, alive, agenda (nullable), nextTickInGameDate (nullable — in-game date, not real-time timestamp)

### World entities

**Location** — id, campaignId, name, description, currentState (SAFE | TENSE | THREATENED | HOSTILE | RUINED), connectedLocationIds (array), recentEvents (JSON)

**Faction** — id, campaignId, name, goals, powerLevel, playerDisposition (ALLY | NEUTRAL | WARY | HOSTILE), territory (locationIds array)

**WorldEvent** — id, campaignId, description, locationId (nullable), deadlineInGameDate (nullable), source (PLAYER_ACTION | WORLD_TICK), status (ACTIVE | RESOLVED | EXPIRED), outcome (nullable), createdAt

### SRD reference entities (seeded on first migration)

Read-only. Seeded from `dnd5eapi.co` JSON on first migration run.

- **SrdClass** — name, hitDie, spellSlotProgression (JSON), proficiencies
- **SrdRace** — name, abilityScoreBonuses (JSON), traits (JSON)
- **SrdSpell** — name, level, school, castingTime, range, components, duration, description, damageDice (nullable)
- **SrdMonster** — name, ac, hp, speed, abilityScores (JSON), actions (JSON), cr
- **SrdEquipment** — name, type, damageDice (nullable), acBonus (nullable), weight, description
- **SrdCondition** — name, description, mechanicalEffects (JSON)

---

## Frontend

### Pages

| Route | Purpose |
|---|---|
| `/auth` | Login / register |
| `/` | Dashboard — campaigns list, create new |
| `/campaign/[id]/setup` | Character creation wizard (before first session) |
| `/campaign/[id]/play` | Main game view |
| `/campaign/[id]/character` | Full character sheet, inventory, spell list |
| `/campaign/[id]/world` | World overview — locations, factions, NPCs, diary |

### Game View Layout

**Narrative mode** (default):
- Left/main column: DM narrative (streams in via SSE subscription), conversation history, suggested action chips below each DM message
- Right sidebar: character name, HP bar, AC, level, active conditions, spell slots
- Bottom: free-text input + send button

**Combat mode** (when `start_combat` tool fires):
- Combat panel slides in on the left: initiative order with HP bars for all combatants, action economy tracker (action / bonus action / reaction / movement), quick action buttons (Attack, Cast Spell, Dash, Dodge, Other), spell slot pips
- Narrative column remains centre — DM describes what's happening
- Right sidebar unchanged
- Combat panel slides out when `end_combat` fires

### GraphQL Subscription (SSE)

```graphql
subscription {
  dmStream(sessionId: ID!) {
    chunk       # text fragment
    done        # true on final chunk
    type        # NARRATIVE | TOOL_RESULT | SUGGESTED_ACTION | COMBAT_EVENT
  }
}
```

---

## Error Handling

- LLM tool call failures (invalid arguments, entity not found): return structured error to LLM so it can recover gracefully in narrative ("the magic fizzles unexpectedly")
- SSE stream interruptions: client reconnects and re-subscribes; session state is server-side so no loss
- World tick failures: log and skip the failing NPC; don't block the day transition
- SRD seed failures on migration: migration fails loudly — seeding is required for the game to function

---

## Testing

- GameEngineModule: unit tested (pure mechanics, deterministic with seeded RNG)
- MemoryModule search: integration tested against real PostgreSQL + pgvector
- LLM tool call parsing: unit tested with fixture responses
- World tick batching logic: unit tested
- API resolvers: integration tested with MikroORM test transactions (roll back after each test)
- Frontend: Vitest for composables and utility logic
