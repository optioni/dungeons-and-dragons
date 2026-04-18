## Context

LLMs cannot hold an entire campaign's history in context. The memory system solves this with two complementary layers: **diary entries** that summarise each in-game day (injected automatically via rolling window), and **memory facts** that capture discrete established details about NPCs, characters, and lore (retrieved on demand via semantic search).

Both layers use Voyage AI embeddings stored in pgvector, enabling the DM to retrieve relevant context by meaning rather than keyword. A full-text fallback ensures correctness when vector search is unavailable or returns no results.

Current state: the database schema has no `DiaryEntry` or `Memory` tables. `LLMModule` has no memory context injection. The `take_long_rest` tool exists in `GameEngineModule` but only advances the in-game date — it does not trigger diary writing.

Dependencies:
- `session-and-llm` — provides `LLMModule`, session context assembly, prompt cache breakpoints
- `campaign-setup` — provides `Campaign` entity with `inGameDate`
- `world-system` depends on `MemoryModule` to write diary before running world tick

## Goals / Non-Goals

**Goals:**
- Persist per-day narrative summaries as `DiaryEntry` records with pgvector embeddings
- Persist discrete facts as `Memory` records keyed to a subject entity (NPC, character, location, etc.)
- Inject the last 7 diary entries into the prompt at cache breakpoint 3 (world + diary)
- Expose `search_memories` as an LLM tool that semantically searches both diary entries and memory facts
- Provide a PostgreSQL full-text fallback when vector search yields no results
- Isolate all memory logic in a single `MemoryModule` that other modules call into

**Non-Goals:**
- Long-term memory compression or summarisation beyond single-day diary entries
- User-facing memory browsing UI (out of scope for this change)
- Cross-campaign memory sharing
- Automatic memory fact extraction (facts are created by explicit LLM tool call only)

## Decisions

### 1. Two-entity model: DiaryEntry and Memory

**Decision:** Separate entities rather than a unified `memory` table with a `type` discriminator.

**Rationale:** Diary entries and memory facts have different shapes, write patterns, and query paths. Diary entries are campaign-wide, time-ordered, and always injected in bulk (last 7). Memory facts are entity-scoped, written ad-hoc, and retrieved only via search. Merging them into one table adds complexity with no benefit — filter clauses would be required everywhere and indices would be less selective.

**Alternative considered:** Single `MemoryRecord` table with `kind: 'diary' | 'fact'` discriminator — rejected because it complicates the rolling-window query and forces unnecessary joins when loading diary context.

### 2. Voyage AI for embeddings, pgvector for storage

**Decision:** Generate embeddings via Voyage AI SDK (`voyage-3-large` model), store as `vector(1024)` columns in pgvector, search with cosine similarity (`<=>` operator).

**Rationale:** Voyage AI is already in the tech stack (API key required in env). pgvector is already enabled on the database instance (added in `srd-seed`). `voyage-3-large` produces 1024-dimensional embeddings, giving high semantic accuracy at manageable storage cost (~4 KB per record).

**Alternative considered:** OpenAI `text-embedding-3-small` — rejected to avoid adding a second AI provider dependency.

### 3. Full-text fallback

**Decision:** When pgvector similarity search returns zero results (or Voyage AI is unavailable), fall back to PostgreSQL full-text search using `tsvector`/`tsquery` on the `content` column.

**Rationale:** Embedding generation can fail (network error, quota). A full-text fallback ensures `search_memories` always returns something meaningful rather than an empty result the LLM must narrate around. Both `DiaryEntry` and `Memory` store a `tsvector` column updated via `BEFORE INSERT OR UPDATE` trigger, avoiding re-indexing overhead at query time.

**Alternative considered:** Returning an empty result on embedding failure and letting the LLM handle it — rejected because the game can recover from sparse results but not from no results when the player references established facts.

### 4. Diary written by Haiku, triggered by take_long_rest

**Decision:** `take_long_rest` tool handler calls `MemoryService.writeDiaryEntry()` before triggering the world tick. `MemoryService` calls Claude Haiku to write the diary narrative from the last session's `GameEvent` records, then generates an embedding and persists the `DiaryEntry`.

**Rationale:** Haiku is the designated background processing model (cheap, fast). Writing the diary synchronously before the world tick ensures the tick's Haiku calls have access to the updated diary if they need it. The rest is already an async operation the player waits for, so no additional latency is perceived.

**Alternative considered:** Async queue job (BullMQ) for diary writing — rejected because the diary must exist before the world tick reads it, and a queue adds ordering complexity with no benefit.

### 5. Last 7 diary entries injected at cache breakpoint 3

**Decision:** `LLMModule` loads the 7 most recent `DiaryEntry` records for the active campaign and includes them in the context assembled at cache breakpoint 3 (world state + diary). This text block is stable between player turns as long as no new rest occurs, so it benefits from prompt caching.

**Rationale:** 7 days maps to roughly one week of in-game time — enough for narrative continuity without overloading the context window. Breakpoint 3 is already the "world + diary" slot in the caching design; injecting there is architecturally consistent.

**Alternative considered:** Injecting all diary entries — rejected due to unbounded context growth. Injecting at breakpoint 4 (session history) — rejected because diary content changes less frequently than session events, so it belongs in a more stable cache tier.

### 6. search_memories as a unified LLM tool

**Decision:** Single `search_memories` tool that accepts a `query` string and optional `subjectType`/`subjectId` filters. Searches `DiaryEntry` and `Memory` tables together, merges results by cosine similarity score, returns top-N ranked records.

**Rationale:** The DM doesn't distinguish between "diary" and "fact" when recalling context — it asks "what do we know about X?" A unified interface is simpler for the LLM to use and lets the retrieval layer rank across both corpora without the LLM having to make two calls.

**Alternative considered:** Separate `search_diary` and `search_facts` tools — rejected because it forces the LLM to decide which corpus to search, doubling token cost for recall steps.

### 7. MemoryModule as a standalone NestJS module

**Decision:** All memory logic lives in `MemoryModule` (entities, service, resolver, migrations). Other modules (`GameEngineModule`, `LLMModule`, `WorldModule`) import `MemoryModule` and call `MemoryService` directly.

**Rationale:** Clear ownership. `MemoryModule` exports only `MemoryService`; consumers don't touch entities or queries. This matches the pattern established by `AuthModule`, `CampaignModule`, etc.

## Risks / Trade-offs

**Voyage AI latency on diary write** → Embedding generation adds ~200–500 ms to the `take_long_rest` flow. Mitigation: diary writing is already a background step the player waits on; acceptable latency. Monitor in production and switch to async if it becomes noticeable.

**pgvector index cold start** → HNSW index on `embedding` column is fast once built but may scan sequentially on small tables. Mitigation: use IVFFlat index with a low `lists` value (e.g. 4) for small datasets; HNSW for larger ones. Add index type as a migration config value so it can be tuned without a schema change.

**Embedding dimension mismatch on model change** → If Voyage AI changes the default embedding dimension, existing vectors become incompatible. Mitigation: pin the model name (`voyage-3-large`) and dimension (1024) as config values. A migration is required if the model changes.

**Growing diary context** → 7 entries is a fixed window, but each entry could be verbose. Mitigation: instruct Haiku (via system prompt) to cap diary entries at ~150 words. Enforce a `content` column length limit (`VARCHAR(1000)`) at the DB level.

**Memory facts without subject context** → A `Memory` with `subjectType: 'npc'` and a stale `subjectId` (deleted NPC) produces orphaned records. Mitigation: cascade delete `Memory` records when the subject entity is deleted. Add a DB-level constraint or application-level cleanup in the relevant module's delete handlers.

## Migration Plan

1. Add pgvector extension check to migration (already present from `srd-seed`, but assert in new migration preamble).
2. Create `DiaryEntry` table: `id`, `campaignId` (FK → `campaign`), `inGameDate` (string, in-game date), `content` (varchar 1000), `embedding` (vector 1024), `createdAt`. Add IVFFlat index on `embedding`.
3. Create `Memory` table: `id`, `campaignId` (FK → `campaign`), `subjectType` (enum), `subjectId` (uuid, nullable), `content` (varchar 1000), `embedding` (vector 1024), `createdAt`. Add IVFFlat index on `embedding`.
4. Add `tsvector` search columns and triggers for full-text fallback on both tables.
5. No data migration required — tables are new.
6. Rollback: drop both tables and their indices; remove `MemoryModule` from `AppModule`.

## Open Questions

- **What `subjectType` values are needed at launch?** Proposal implies NPC, character, location, faction. Should `world_event` be included? Recommend starting with: `npc | character | location | faction | item | general`.
- **Should diary entries be editable by the DM via GraphQL?** Likely yes for debugging, but not needed at launch. Defer to a future change.
- **Full-text fallback language?** PostgreSQL `tsvector` defaults to `english`. Will diary content ever be multilingual? Assume English for now; add `regconfig` column if needed later.
