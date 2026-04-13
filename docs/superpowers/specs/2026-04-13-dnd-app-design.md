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

**Tooling (monorepo-wide):**
- ESLint with `@juuso.piikkila/eslint-config-typescript` for both `api/` and `web/` — uses its Vue configuration for the web app
- Prettier for formatting; `eslint-config-prettier` to disable conflicting ESLint rules
- Single `prettier.config.js` at the monorepo root; each package extends the shared ESLint config as needed

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
- `roll_death_save(characterId)` — rolls d20, applies success or failure, returns stabilised/dead/ongoing
- `instant_death(characterId)` — triggered when damage in one hit exceeds maxHp (e.g. massive environmental event); bypasses death saves
- `stabilise(characterId)` — sets hp to 1, resets death save counters
- `take_short_rest(characterId)` — partial HP recovery via hit dice, certain ability recharges, no day advance
- `take_long_rest(characterId)` — full HP and spell slot recovery, increments `inGameDate`, triggers diary write + world tick
- `set_scene_type(sessionId, sceneType)` — switches active prompt module
- `advance_antagonist_stage(campaignId)` — marks current antagonist plan stage complete, advances to next
- `record_lore(campaignId, fact)` — appends an established fact to the campaign lore document
- `create_item(campaignId, fields)` — creates a custom item (e.g. magic loot found during play)
- `give_item(itemId, quantity, toCharacterId?, toNpcId?)` — transfers item to character or NPC inventory
- `equip_item(characterItemId, slot)` / `unequip_item(characterItemId)` — manages equipped state
- `buy_item(characterId, npcId, itemId, quantity)` — transfers item, deducts gold from character
- `sell_item(characterId, npcId, itemId, quantity)` — transfers item, adds gold to character
- `restock_merchant(npcId, items[])` — refreshes merchant stock (used by world tick)
- `add_to_party(npcId)` — NPC joins the player as companion; suspends their world tick agenda
- `remove_from_party(npcId)` — NPC leaves the party (voluntarily or forced by story events)
- `travel_to(campaignId, locationId)` — moves player to connected location, advances in-game time, may trigger random encounter
- `check_skill(characterId, skill, dc)` — rolls d20 + ability modifier + proficiency bonus (if proficient), returns pass/fail
- `trigger_level_up(characterId)` — fired when XP threshold reached; pauses session for player to choose new abilities
- `apply_level_up(characterId, choices)` — commits level-up choices, updates stats and abilities
- `prepare_spells(characterId, spellIds[])` — sets prepared spells for Wizard/Cleric/Druid after long rest
- `create_quest(campaignId, fields)` — creates a new quest
- `update_quest_objective(questId, objectiveIndex, completed)` — marks an objective done
- `complete_quest(questId)` / `fail_quest(questId)` — resolves a quest, applies rewards
- `trigger_catastrophe(campaignId, description, locationId?)` — fires a random world catastrophe; used by world tick on low-probability random roll

Reads SRD data for spell effects, monster stat blocks, condition rules.

### MemoryModule
The campaign's long-term memory system.

**Diary entries:** Written by Claude Haiku at the end of each in-game day. Summarises events, decisions, and consequences. Stored with a pgvector embedding (generated via Voyage AI embeddings API) and PostgreSQL `tsvector` for full-text search.

**Memory facts:** Discrete facts about characters and NPCs accumulated during play ("Theron owes a debt to the Thieves Guild", "Marta the innkeeper is secretly an informant"). Also stored with embeddings.

**Prompt injection:** Last 7 diary entries are automatically included in every DM prompt. Older entries are retrievable via LLM tool:
- `search_memories(query, subjectId?)` — semantic similarity search via pgvector across both diary entries and memory facts

**Day transition:** When the LLM calls `take_long_rest`, SessionModule enqueues a world tick job and triggers MemoryModule to write the diary entry (Haiku call). `take_long_rest` is the only mechanism for day transitions — the server never infers it automatically. Time of day within a day (morning, afternoon, evening, night) is tracked narratively by the LLM, not as a database field.

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

**Character** — id, userId, name, race (ref SrdRace), class (ref SrdClass), level, abilityScores (JSON), hp, maxHp, ac, conditions (array), spellSlots (JSON by level), preparedSpells (array of SrdSpell ids, nullable — Wizard/Cleric/Druid only), skillProficiencies (array of skill names), goldPieces, silverPieces, copperPieces, xp, proficiencyBonus, deathSaveSuccesses (0-3), deathSaveFailures (0-3), isDead

**Campaign** — id, userId, characterId, name, inGameDate, currentLocationId, loreDocument (text), deathMode (PERMADEATH | STORY), createdAt

**GameSession** — id, campaignId, startedAt, endedAt, sceneType (EXPLORATION | COMBAT | SOCIAL | SETTLEMENT | REST)

**GameEvent** — id, sessionId, type (PLAYER_INPUT | DM_NARRATIVE | TOOL_CALL | COMBAT_EVENT | SYSTEM), content, timestamp

**DiaryEntry** — id, campaignId, inGameDate, content, embedding (vector), createdAt

**Memory** — id, campaignId, subjectType (CHARACTER | NPC), subjectId, content, embedding (vector), createdAt

**Npc** — id, campaignId, name, description, profession (string — e.g. "blacksmith", "city guard captain"), coreMotivation, personalityTraits (array), speechStyle, disposition, currentLocationId, alive, hp (nullable — tracked for companions and combat-capable NPCs), maxHp (nullable), partyStatus (NONE | COMPANION | TEMPORARY_ALLY), agenda (nullable), nextTickInGameDate (nullable — in-game date, not real-time timestamp)

**NpcRelationship** — id, sourceNpcId, targetNpcId, type (ALLY | RIVAL | EMPLOYER | FAMILY | INFORMANT | ENEMY), description, disposition. Used by WorldModule to identify NPC pairs with reason to interact during world tick.

**Item** — id, campaignId (nullable for SRD items), name, type (WEAPON | ARMOR | GEAR | CONSUMABLE | MAGIC | QUEST), description, damageDice (nullable), damageType (nullable), acBonus (nullable), properties (JSON — magic effects, special rules), weight, goldValue, srdEquipmentId (nullable)

**CharacterItem** — id, characterId, itemId, quantity, equipped, equippedSlot (MAIN_HAND | OFF_HAND | ARMOR | ACCESSORY, nullable), condition (NORMAL | DAMAGED | BROKEN), notes (nullable)

**NpcItem** — id, npcId, itemId, quantity, priceInGold. Used for merchant stock and lootable NPC inventories.

### World entities

**Location** — id, campaignId, name, description, currentState (SAFE | TENSE | THREATENED | HOSTILE | RUINED), connectedLocationIds (array), recentEvents (JSON)

**Faction** — id, campaignId, name, goals, powerLevel, playerDisposition (ALLY | NEUTRAL | WARY | HOSTILE), territory (locationIds array)

**WorldEvent** — id, campaignId, description, locationId (nullable), deadlineInGameDate (nullable), source (PLAYER_ACTION | WORLD_TICK | CATASTROPHE), status (ACTIVE | RESOLVED | EXPIRED), outcome (nullable), createdAt

**Quest** — id, campaignId, title, description, type (MAIN | SIDE), status (ACTIVE | COMPLETED | FAILED | ABANDONED), rewardGold (nullable), rewardXp (nullable), rewardItemId (nullable), sourceNpcId (nullable), agendaImpact (text — how completion or failure affects the source NPC's agenda; used by the LLM when resolving the quest to determine what update_npc call to make), createdAt

**QuestObjective** — id, questId, description, type (REACH_LOCATION | NPC_DEAD | NPC_ALIVE | HAVE_ITEM | TALK_TO_NPC | MANUAL), entityId (nullable — references the NPC / Location / Item the condition checks), completed, completedAt. Indexed on (type, entityId, completed) for fast auto-completion lookups after tool calls.

**QuestEntity** — id, questId, entityType (NPC | LOCATION | ITEM | WORLD_EVENT), entityId. Tracks all entities scaffolded when the quest was created — locations, NPCs, items, and world events spawned specifically for this quest.

Quests are expressions of the giver NPC's agenda — generated in the context of their `coreMotivation` and `agenda`. Resolving a quest always feeds back into the source NPC's agenda via `update_npc`. The antagonist's plan stages are the villain's equivalent — their objectives from their own perspective, which the player can discover and disrupt.

After every state-changing tool call (travel_to, apply_damage, give_item, etc.) the game engine runs an auto-checker: query `QuestObjective WHERE type = <relevant type> AND entityId = <affected entity> AND completed = false` and marks any matching objectives complete. If all objectives for a quest are complete, the LLM is notified to narrate the resolution and call `complete_quest`.

### SRD reference entities (seeded on first migration)

Read-only. Seeded from `dnd5eapi.co` JSON on first migration run.

- **SrdClass** — name, hitDie, spellSlotProgression (JSON), proficiencies
- **SrdRace** — name, abilityScoreBonuses (JSON), traits (JSON)
- **SrdSpell** — name, level, school, castingTime, range, components, duration, description, damageDice (nullable)
- **SrdMonster** — name, ac, hp, speed, abilityScores (JSON), actions (JSON), cr
- **SrdEquipment** — name, type, damageDice (nullable), acBonus (nullable), weight, description
- **SrdCondition** — name, description, mechanicalEffects (JSON)

---

## Narrative Design

### Campaign Setup Flow

Before the first session, the player goes through a guided setup:

1. **Character creation** — race, class, ability score assignment, character name and backstory (optional)
2. **Tone selection** — player picks the campaign tone: Dark & Gritty, Epic Fantasy, Balanced, or provides a custom brief. Tone shapes the DM system prompt and the flavour of generated content throughout the campaign.
3. **Story concept selection** — LLM generates 3-4 story concepts tailored to the character and chosen tone. Player picks one. Concepts include a premise, a central conflict, and a hint at the antagonist.
4. **World seed generation** — based on the chosen concept, the LLM generates and persists the initial world:
   - 3-5 named locations with descriptions and initial states
   - 2-3 factions with goals and dispositions toward each other
   - A handful of key NPCs, some with active agendas
   - A main antagonist with a plan already in motion (persisted as an NPC with an agenda and as an active WorldEvent)
   - An opening scene description for the first DM message
5. **First session begins** — the player steps into a world with threads already in motion

### Story Arc

Every campaign has a main antagonist whose plan drives the overarching narrative. The LLM weaves this throughout sessions — clues surface naturally, consequences accumulate, faction dynamics shift as the antagonist advances their agenda via the world tick. The campaign builds toward a climax and a meaningful conclusion when the antagonist is confronted or defeated.

The main antagonist is an NPC with an agenda like any other, but their `nextTickInGameDate` resets frequently — they are always active, always making moves.

### Companions

NPCs with `partyStatus = COMPANION` or `TEMPORARY_ALLY` travel with the player. While in the party:
- Their `currentLocationId` stays in sync with the campaign's `currentLocationId`
- The LLM voices them in-session: reactions, opinions, banter — shaped by `personalityTraits`, `coreMotivation`, and `relationships`
- In combat they appear in the initiative tracker and act on their turn (LLM-controlled); the player can direct them via natural language
- Their world tick agenda is suspended — they observe events alongside the player rather than acting independently
- They are subject to death saves and the campaign death mode like the player
- They can leave the party if the player's actions consistently conflict with their `coreMotivation` — the LLM judges when this threshold is crossed

### Player Death

Death is real and can happen at any moment — a villain's ambush, a burning building, a catastrophic dice roll. The world does not protect the player.

**Dying (0 HP):** Character falls unconscious. Each subsequent turn the LLM calls `roll_death_save`. Three successes → `stabilise`. Three failures → dead. Other characters or NPCs can intervene with a Medicine check or healing spell.

**Instant death:** If a single hit exceeds the character's maximum HP (massive rock, town collapsing), `instant_death` is called — no death saves.

**On death — determined by campaign `deathMode`:**
- **PERMADEATH** — campaign ends. The world remembers what the player did. A memorial entry is written to the diary. A new campaign can be started.
- **STORY** — resurrection is available but costs something significant narratively: a debt to a deity, a favour owed to a powerful NPC, a permanent consequence. The LLM determines the cost in context. The campaign continues.

**Death mode** is chosen during campaign setup alongside tone and story concept.

### Narrative Consistency

Several redundant anchors keep the story consistent across sessions as context scrolls away:

**Structured NPC profiles** — key NPCs have structured fields beyond free text: `coreMotivation`, `personalityTraits` (array), `speechStyle`, `relationships` (JSON). When a known NPC appears in a scene, these fields are injected into context explicitly so characterisation cannot drift.

**Antagonist plan stages** — the antagonist's overarching plan is broken into named stages (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FOILED`). The current stage is always in the system prompt. The LLM advances stages via an `advance_antagonist_stage` tool call, making the villain's arc a structured progression rather than a free-form invention.

**Campaign lore document** — a living text document created at world seed time and appended to as the campaign progresses. Captures immutable facts: geography, established world rules, major faction dynamics, key plot points. Stored on Campaign, injected into the system prompt. The LLM appends new established facts via a `record_lore(fact)` tool.

**Established facts as Memory** — when the LLM establishes a significant detail mid-session ("the innkeeper has a sister in the capital", "the eastern bridge collapsed"), it writes a Memory fact immediately via the existing memory system. Searchable in future sessions.

**Proactive memory search** — before narrating a scene involving a known NPC, the LLM searches their memory facts to recall past interactions and established characterisation.

### Dynamic Prompt Modules

Rather than one monolithic system prompt, the LLMModule assembles context from a base plus scene-appropriate modules loaded dynamically. Modules are stable text files — good prompt cache candidates.

**Available modules:**
- **Combat** — loaded when `scene_type = COMBAT`. Combat narration style, action economy reminders, how to describe dice outcomes dramatically.
- **Social/NPC** — loaded for `SOCIAL` scenes. NPC roleplay guidance, persuasion/deception/insight check handling.
- **Exploration** — loaded for `EXPLORATION`. Dungeon/wilderness pacing, environment description, trap and discovery handling.
- **Settlement** — loaded for `SETTLEMENT`. Urban encounters, shops, taverns, political intrigue.
- **Rest & Downtime** — loaded for `REST`. Recovery narration, time passing, rumour delivery.
- **Rules reference snippets** — specific SRD sections (spellcasting, conditions, grappling) loaded on demand when those mechanics are active, rather than always present.

`scene_type` is a field on GameSession (`EXPLORATION`, `COMBAT`, `SOCIAL`, `SETTLEMENT`, `REST`), set via a `set_scene_type` tool call when the scene changes. Cache breakpoint 1 covers: system prompt base + active modules for the current scene.

### DM System Prompt Composition

Assembled per scene from layers, with prompt caching applied:

- **Base** (cache breakpoint 1): DM persona and narration style, world name and geography summary, campaign tone, tool definitions, active scene module(s)
- **Campaign state** (cache breakpoint 2): lore document, antagonist current plan stage, faction dispositions
- **Character + world** (cache breakpoint 3): character state, current location, active world events, last 7 diary entries
- **Session history** (cache breakpoint 4): current session GameEvents up to previous turn
- **Current input** (uncached): latest player input

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
| `/campaign/[id]/quests` | Active and completed quests, objectives |

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
- World tick race condition: while the world tick job is running, a `campaignLocked` flag is set in Redis. If a player action touches an entity that may be affected, the resolver waits briefly for the lock to clear before querying. Lock is released when the job completes or fails.
- SRD seed failures on migration: migration fails loudly — seeding is required for the game to function

---

## Testing

- GameEngineModule: unit tested (pure mechanics, deterministic with seeded RNG)
- MemoryModule search: integration tested against real PostgreSQL + pgvector
- LLM tool call parsing: unit tested with fixture responses
- World tick batching logic: unit tested
- API resolvers: integration tested with MikroORM test transactions (roll back after each test)
- Frontend: Vitest for composables and utility logic
