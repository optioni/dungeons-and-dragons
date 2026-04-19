## Context

The world needs to move without the player. NPCs pursue agendas, factions shift power, catastrophes strike — whether or not the player is present. This living-world behavior is triggered by `take_long_rest` and processes in the background via BullMQ.

**Current state:**
- `WorldModule` owns all world entities (Location, Faction, WorldEvent, Npc, NpcRelationship, etc.)
- `Npc` already has `agenda` and `nextTickInGameDate` fields
- `NpcRelationship` already models directional NPC-to-NPC bonds
- `WorldEventSource.CATASTROPHE` is already registered as an enum value
- `BullModule` is already configured in `AppModule` with Redis
- No `QueueModule` exists yet; no world tick worker exists

**Constraints:**
- No hardcoded model names — all via `ConfigService`
- All LLM tool results must be structured so the model can recover gracefully
- Haiku everywhere in background processing; Sonnet only for DM session

---

## Goals / Non-Goals

**Goals:**
- `QueueModule` — encapsulates BullMQ queue registration and a Redis-backed SRD cache; re-exported to all consumers
- World tick worker — sequenced processing: diary → NPC agendas → NPC conversations → outcome application → catastrophe roll
- NPC agenda processing — lazy evaluation (skip NPCs whose `nextTickInGameDate` hasn't passed), batched non-interacting Haiku calls
- NPC conversations — relationship-driven pair detection, structured 2-turn Haiku dialogue, outcome extraction
- Catastrophe system — `trigger_catastrophe` LLM tool that creates a `CATASTROPHE`-sourced `WorldEvent` with low probability
- `take_long_rest` integration — enqueues world tick job after rest resolves, acquires Redis lock `campaignLocked`

**Non-Goals:**
- Real-time NPC pathfinding or continuous position tracking — movement is coarse-grained (one location update per tick as an agenda outcome)
- Faction politics beyond what NPC agendas and world events already model
- Player-visible world tick progress or streaming — tick runs silently in background
- Multi-player or concurrent campaign support

---

## Decisions

### 1. QueueModule as a thin registration module

**Decision:** Create `QueueModule` as a dedicated NestJS module that registers the `world-tick` BullMQ queue and the Redis `CacheModule`. It exports both so `WorldModule`, `SessionModule`, and any future consumers can import them without re-declaring.

**Why over embedding in WorldModule:** Single responsibility. WorldModule owns world entities; QueueModule owns job infrastructure. Separation avoids circular deps when SessionModule needs to enqueue jobs.

**Alternatives considered:**
- Embed in `WorldModule` directly — creates a circular dep when `SessionModule` needs the queue
- Embed in `AppModule` — violates single responsibility; App module should stay thin

### 2. World tick worker lives in WorldModule

**Decision:** `WorldTickWorker` (`@Processor('world-tick')`) lives inside `WorldModule` alongside the entities it mutates. It injects `WorldService`, `MemoryModule`, and `LlmModule`.

**Why over a separate TickModule:** The worker's only concern is mutating world state — it belongs next to the entities it owns. A separate module would be a thin wrapper with no independent reason to exist.

### 3. Tick sequence: agendas → conversations → outcomes → catastrophe → diary

**Decision:** Process in strict order within a single job:
1. Evaluate NPC agendas — batched Haiku calls for NPCs whose `nextTickInGameDate` ≤ current in-game date (up to `maxNpcsPerTick`, prioritised by most overdue)
2. Run NPC conversations — identify co-located NPC pairs with relationships, run 2-turn Haiku dialogue
3. Apply all outcomes atomically — update entity state in a single ORM flush
4. Catastrophe roll — low-probability `trigger_catastrophe` Haiku call; creates `WorldEvent` with `source: CATASTROPHE`
5. Write diary entry (MemoryModule) — captures post-tick world state including all changes

**Why diary last:** A post-tick diary entry ("Gareth fled, the thieves' guild made their move") is narratively richer than a pre-tick snapshot. The diary summarises what actually happened this tick, making it useful DM context for the next session.

**Why ordered over parallel:** Outcomes must be atomic (no partial-write bugs). Catastrophe runs after agendas/conversations so it can react to their outcomes. Diary runs last so it reflects the full picture.

### 4. NPC agenda batching — non-interacting NPCs in parallel

**Decision:** Group NPCs into independent sets (no shared `currentLocationId`) and call Haiku in parallel batches. Interacting NPCs (same location) process sequentially to avoid conflicting writes.

**Cap:** A configurable `maxNpcsPerTick` (default 10) limits Haiku calls per tick. When more NPCs are due, prioritise by most-overdue `nextTickInGameDate` using round-robin across ticks so no NPC is permanently starved.

**Why:** Reduces tick wall-clock time proportionally to the number of independent NPCs. Correctness requires sequential handling for co-located NPCs since a conversation step may change location. The cap keeps ticks predictable regardless of campaign size.

**Alternatives considered:**
- Sequential per-NPC — simple but slow at scale
- Full parallel — risks conflicting writes for co-located NPCs
- No cap — unbounded cost with large NPC rosters

### 4a. NPC movement generates a departure WorldEvent

**Decision:** When an agenda outcome includes `newLocationId`, two writes occur atomically:
1. `Npc.currentLocationId` updated to the destination
2. A `WorldEvent` created at the *departure* location (`source: WORLD_TICK`) describing the NPC's departure and stated destination (if the NPC disclosed one)

**Why a WorldEvent rather than relying on diary:** The diary is DM-internal context. `WorldEvent` rows are loaded per-location into the DM session context — so when the player asks a townsperson "where did Gareth go?", the DM can surface the departure event naturally without knowing the diary. The player must physically be in the departure location to learn it; they then travel the chain to follow the NPC.

**Information fidelity:** Haiku decides what the NPC "said" when leaving. A secretive NPC's departure event may omit the destination; a chatty one may mention a specific town. This creates an authentic breadcrumb trail rather than omniscient tracking.

### 5. NPC conversations — pair detection via location + NpcRelationship

**Decision:** After agenda step, query for NpcRelationship rows where both source and target share `currentLocationId`. For each qualifying pair, run a 2-turn Haiku dialogue (NPC A speaks → NPC B responds). Extract structured outcome: `{relationshipChange, itemExchanged, newAgenda}`.

**Limit:** At most one conversation per NPC per tick. Pairs are prioritised by relationship type (ENEMY/RIVAL before ALLY/NEUTRAL — conflicts drive more interesting world change), with recency of last conversation as a tiebreaker so the same pair doesn't dominate every tick.

**Why 2-turn cap:** Long multi-turn conversations don't add proportional world-state value and make ticks unpredictably expensive.

### 6. Redis lock `campaignLocked` prevents overlapping ticks

**Decision:** The worker acquires an `ioredis` SETNX lock keyed `campaignLocked:<campaignId>` before processing and releases it in `finally`. If the lock is already held (concurrent rest triggered somehow), the job exits early with a structured no-op result.

**Why:** BullMQ's `concurrency: 1` per-queue setting alone doesn't prevent a second job from starting before the first job's DB writes commit. A Redis lock gives an explicit campaign-scoped guard.

### 7. `trigger_catastrophe` as an LLM-callable tool

**Decision:** Expose `trigger_catastrophe` as a GameEngineModule tool available during the world tick Haiku call (not during the DM session). The tool creates a `WorldEvent` row with `source: CATASTROPHE`. The LLM decides whether to invoke it based on a probability instruction in the system prompt (~5% chance framing).

**Why as a tool over server-side roll:** The LLM generates the catastrophe narrative as part of tool execution — richer descriptions, contextually appropriate events. A server-side roll would require a separate LLM call to generate the description anyway.

**Why CATASTROPHE source already exists:** `WorldEventSource.CATASTROPHE` is already registered in the enum — the entity schema is ready.

---

## Risks / Trade-offs

**Long tick duration with many NPCs** → Mitigate: Parallel batching (Decision 4). If tick still exceeds acceptable wall-clock time, add a configurable `maxNpcsPerTick` cap with round-robin scheduling across ticks.

**Redis lock not released on worker crash** → Mitigate: Set a TTL on the lock (e.g., 10 minutes — longer than any realistic tick). BullMQ's job retry logic won't re-enter while lock is held; lock expires and next rest can proceed.

**NPC conversation outcomes conflicting with agenda outcomes** → Mitigate: Sequential flush at end of tick (Decision 3, step 4). All outcome objects are collected first, then applied in one `em.flush()`.

**Haiku model cost at scale** → Acceptable trade-off. Haiku is ~20× cheaper than Sonnet. World ticks are infrequent (one per long rest). If cost becomes a concern, batching already limits calls per tick.

**`nextTickInGameDate` is a narrative string, not a real timestamp** → The LLM must compare in-game dates textually during agenda evaluation. Mitigate: Provide the current in-game date explicitly in each NPC agenda prompt so Haiku can determine "has time passed."

---

## Migration Plan

1. Add `QueueModule` — no schema changes; no migration needed
2. Add `WorldTickWorker` to `WorldModule` — no schema changes
3. Wire `take_long_rest` in `SessionModule`/`GameEngineModule` to enqueue world tick — no schema changes
4. `WorldEventSource.CATASTROPHE` is already in the enum and seeded — no migration needed
5. Deploy: Redis must be running (already required by existing `BullModule` config)
6. Rollback: Remove the BullMQ `@Processor` registration and the `QueueModule` import from `WorldModule`; `take_long_rest` reverts to not enqueuing. No data is lost — `WorldEvent` rows with `CATASTROPHE` source persist harmlessly.

---

## Open Questions

None — all questions resolved in design.
