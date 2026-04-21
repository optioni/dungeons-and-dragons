## Context

The existing `Memory` table stores campaign-level facts *about* entities (tagged by `subjectType` / `subjectId`). It is the DM's notebook — facts recorded during play for later recall.

NPCs currently have no episodic memory: the `Npc.agenda` field encodes what they are currently pursuing but not what shaped that agenda. `WorldTickWorker.evaluateSingleNpcAgenda` builds its Haiku prompt from static NPC fields only (name, profession, personality, agenda). There is no record of what an NPC has witnessed, nor any mechanism for NPCs to share knowledge between themselves.

The `EmbeddingService` (Voyage AI) and pgvector infrastructure are established in `MemoryModule` and can be reused.

## Goals / Non-Goals

**Goals:**
- Persist what each NPC has experienced or been told as queryable `NpcMemory` rows with pgvector embeddings
- Feed semantically relevant NPC memories into world-tick agenda evaluation
- Feed NPC memories into conversation prompts, and persist shared knowledge as new memories for the receiving NPC
- Include NPC memories in DM session context when those NPCs are present in the active scene
- Provide a `record_npc_memory` DM session tool so the LLM can record notable player interactions from an NPC's perspective

**Non-Goals:**
- Memory pruning or summarization (deferred — no token-budget issue yet)
- GraphQL API for querying NPC memories (internal server concern only)
- Tracking propagation chains deeper than one hop (`sourceNpcId` records who told them; further depth is addressed by future agenda evaluations that naturally incorporate downstream knowledge)
- NPC memories created by the world-tick affecting the current DM session without a rest cycle (memories created during a tick are available on the next player input)

## Decisions

### 1. New `NpcMemory` table, not extending `Memory`

**Decision:** Create a separate `NpcMemory` entity rather than adding a `perspectiveNpcId` column to `Memory`.

**Rationale:** `Memory` is the *campaign's* notebook — facts about the world from the DM/player perspective, tagged by subject. `NpcMemory` is an NPC's *personal* experience — what they have witnessed or been told. These are different concepts with different query patterns (fetch all memories for NPC X vs. search facts about NPC X). Conflating them into one table would make queries awkward and the semantic model confusing.

**Alternative considered:** `perspectiveNpcId` on `Memory` — rejected because it would make `subjectId` ambiguous (is this the subject of the fact, or the witness?) and would break existing `searchMemories` semantics.

### 2. `NpcMemory` lives in `WorldModule`

**Decision:** `NpcMemory` entity and `NpcMemoryService` are owned by `WorldModule`, not `MemoryModule`.

**Rationale:** `MemoryModule` is campaign-scoped (diary entries, memory facts). All NPC entities (`Npc`, `NpcRelationship`, `NpcItem`) already live in `WorldModule`. `WorldTickWorker` and world context assembly both live there. Keeping NPC memory alongside NPC entities avoids cross-module entity ownership.

`NpcMemoryService` borrows `EmbeddingService` from `MemoryModule` by importing `MemoryModule` in `WorldModule` — the same pattern used for `MemoryService` injection in `WorldTickWorker` today.

### 3. `record_npc_memory` registered in `GameEngineModule`

**Decision:** The DM session tool `record_npc_memory` is registered in `GameEngineToolRegistrarService` alongside the existing `record_memory` / `search_memories` tools.

**Rationale:** All DM session tools are registered there. `NpcMemoryService` is injected via `WorldModule` import, which `GameEngineModule` already imports for world mutation tools.

### 4. Semantic retrieval at world-tick time, capped per NPC

**Decision:** Before each Haiku agenda call, fetch the top 5 most semantically relevant `NpcMemory` rows for that NPC using the NPC's current `agenda` as the query. For conversation context, fetch the top 3 per NPC (6 total per pair).

**Rationale:** Including all memories for a long-running NPC would blow the token budget. Semantic search against the current agenda surfaces the memories most likely to influence the next decision. The cap is a config value (`NPC_MEMORY_AGENDA_LIMIT`, default 5; `NPC_MEMORY_CONVERSATION_LIMIT`, default 3).

**Alternative considered:** Chronological last-N — rejected because the most recent memory may be irrelevant to the current agenda topic (e.g., a food-sharing memory irrelevant to a revenge plot).

### 5. Shared memories persisted atomically in `applyOutcomes`

**Decision:** `ConversationOutcome` gains a `sharedMemories` field. `applyOutcomes` creates `NpcMemory` rows for received knowledge in the same `em.flush()` call as agenda/relationship/item updates.

**Rationale:** Shared memories are part of the tick outcome batch — they must succeed or fail with the rest of the tick state. Creating them in a separate flush would risk partial state if the process crashes between flushes.

### 6. NPC memories injected into `ContextLoader.loadWorldBlock` (Block 3)

**Decision:** When loading Block 3, fetch NPCs at the current location and include their top semantically relevant memories (up to 10 total, across all NPCs at the scene). Query uses the session's most recent player input as the semantic search query.

**Rationale:** Block 3 is the "world state" block — character sheet, diary entries, current scene. NPC memories belong here because they are scene-stable (change when the player moves to a new location or rests). Using the player's last input as the search query surfaces memories most relevant to the current interaction.

**Cache implication:** Adding NPC memories to Block 3 means Block 3 cache is invalidated more frequently (any new NPC memory at the current location invalidates it). This is acceptable — Block 3 already invalidates on diary entries and world events.

### 7. `inGameDate` stored as narrative string on `NpcMemory`

**Decision:** `NpcMemory.inGameDate` is a nullable text field (same pattern as `DiaryEntry.inGameDate` and `Npc.nextTickInGameDate`), not a real timestamp.

**Rationale:** The game operates on an in-game narrative date, not a wall clock. Real `createdAt` is also stored for ordering and audit purposes.

## Risks / Trade-offs

**Block 3 cache churn** → NPC memories at the active location invalidate Block 3 on every turn that produces a new memory. Mitigated by the retrieval cap (top 10 total) and the fact that most turns will not produce new NPC memories.

**Embedding cost per memory** → Each `record_npc_memory` call triggers a Voyage AI embedding. Mitigated by the fact that this is a model-initiated tool (not called on every turn) and embeddings are already used for diary entries and memory facts.

**Haiku prompt growth at world-tick** → Including 5 memories per NPC in agenda evaluation increases token usage. Mitigated by the configurable cap and the fact that world-tick already runs Haiku (lower cost per token than Sonnet).

**One-hop propagation only** → `sourceNpcId` records who told an NPC something, but not the full chain. If NPC C learns from NPC B who learned from NPC A, only the B→C link is stored. Acceptable for now — the agenda evaluation cycle will naturally incorporate downstream knowledge over time.

## Migration Plan

1. Add `NpcMemory` entity → generate MikroORM migration → `migration:up` in dev
2. `WorldModule`: add `NpcMemoryService`, register `NpcMemory` repository
3. `GameEngineModule`: register `record_npc_memory` tool
4. `WorldTickWorker`: enrich agenda and conversation prompts with fetched memories; extend `ConversationOutcome` and `applyOutcomes`
5. `ContextLoader`: extend `loadWorldBlock` to accept optional NPC memory context; update `LLMModule` caller to supply it

No data migration required — existing NPCs start with zero memories and accumulate them naturally from the next session forward.

Rollback: drop `npc_memory` table, remove tool registration, revert worker and context-loader changes. No existing data is modified.

## Open Questions

- **Memory importance weight?** Should some memories (e.g., "player attacked me") carry higher retrieval priority than semantic similarity alone? Deferred — semantic search is sufficient for the first pass.
- **NPC memory GraphQL exposure?** Could be useful for a DM debug view. Not in scope for this change.
- **Cross-campaign NPC transfer?** NPCs do not currently move between campaigns. If they ever do, `NpcMemory.npcId` is sufficient as the FK without a `campaignId`. No action needed now.
