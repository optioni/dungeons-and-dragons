## 1. Database Migration

- [x] 1.1 Create MikroORM migration that adds `diary_entry` table with columns: `id`, `campaign_id` (FK → `campaign`), `in_game_date` (varchar), `content` (varchar 1000), `embedding` (vector 1024), `created_at`
- [x] 1.2 Create MikroORM migration that adds `memory` table with columns: `id`, `campaign_id` (FK → `campaign`), `subject_type` (enum: `npc | character | location | faction | item | general`), `subject_id` (uuid nullable), `content` (varchar 1000), `embedding` (vector 1024), `created_at`
- [x] 1.3 Add IVFFlat index on `diary_entry.embedding` and `memory.embedding` in the migration
- [x] 1.4 Add `search_vector` tsvector columns and `BEFORE INSERT OR UPDATE` triggers on both tables in the migration
- [x] 1.5 Add cascade delete from `campaign` → `diary_entry` and `campaign` → `memory`

## 2. MikroORM Entities

- [x] 2.1 Create `DiaryEntry` entity class in `apps/api/src/memory/entities/diary-entry.entity.ts` with all column decorators including the vector type
- [x] 2.2 Create `Memory` entity class in `apps/api/src/memory/entities/memory.entity.ts` with `SubjectType` enum and all column decorators
- [x] 2.3 Add `@OneToMany(() => DiaryEntry, ...)` and `@OneToMany(() => Memory, ...)` relations to the `Campaign` entity

## 3. MemoryModule Scaffold

- [x] 3.1 Create `MemoryModule` in `apps/api/src/memory/memory.module.ts` — import entities, export `MemoryService`
- [x] 3.2 Register `MemoryModule` in `AppModule`
- [x] 3.3 Add `VOYAGE_API_KEY` to `apps/api/.env.example` and validate it in `ConfigModule`

## 4. Voyage AI Embedding Service

- [x] 4.1 Add `voyageai` SDK to `apps/api/package.json` (or confirm it is already present)
- [x] 4.2 Create `EmbeddingService` in `apps/api/src/memory/embedding.service.ts` with a `generateEmbedding(text: string): Promise<number[] | null>` method that calls `voyage-3-large` and returns null on failure
- [x] 4.3 Write unit tests for `EmbeddingService` covering success and API-failure (null return) paths

## 5. MemoryService — Diary System

- [x] 5.1 Implement `MemoryService.writeDiaryEntry(campaignId, inGameDate, gameEvents)` — calls Haiku to write narrative (≤1000 chars), generates embedding, persists `DiaryEntry`
- [x] 5.2 Implement `MemoryService.getRecentDiaryEntries(campaignId, limit = 7)` — returns last N entries ordered by `inGameDate` descending
- [x] 5.3 Write unit tests for `writeDiaryEntry` covering: entry created, content capped, embedding failure still persists entry
- [x] 5.4 Write unit tests for `getRecentDiaryEntries` covering: fewer than 7 entries, exactly 7, more than 7

## 6. MemoryService — Memory Facts

- [x] 6.1 Implement `MemoryService.createMemory(campaignId, subjectType, content, subjectId?)` — generates embedding, persists `Memory` record
- [x] 6.2 Write unit tests for `createMemory` covering: success, embedding failure still persists, invalid subject type rejected before persist

## 7. MemoryService — Semantic Search

- [x] 7.1 Implement `MemoryService.searchMemories(campaignId, query, options?)` — generates query embedding, runs parallel cosine similarity queries against both tables, merges and ranks results
- [x] 7.2 Implement full-text fallback in `searchMemories` — activated when vector search returns zero results or embedding call fails
- [x] 7.3 Define and export `MemorySearchResult` typed interface (`type: 'diary' | 'fact'`, `content`, `score`, `subjectType?`, `subjectId?`, `inGameDate?`)
- [x] 7.4 Write unit tests for `searchMemories` covering: results from both tables merged, subject type filter, limit respected, full-text fallback on zero vector results, full-text fallback on embedding failure, empty results from both searches

## 8. LLM Tool Registration

- [x] 8.1 Register `record_memory` tool in `GameEngineModule` tool registry — delegates to `MemoryService.createMemory()`, returns structured success/failure result
- [x] 8.2 Register `search_memories` tool in `GameEngineModule` tool registry — delegates to `MemoryService.searchMemories()`, returns structured result with typed records
- [x] 8.3 Write unit tests for both tool handlers covering structured success and structured failure responses

## 9. take_long_rest Integration

- [x] 9.1 Update the `take_long_rest` tool handler in `GameEngineModule` to call `MemoryService.writeDiaryEntry()` with the session's `GameEvent` records before dispatching the world tick BullMQ job
- [x] 9.2 Write a unit test confirming diary entry is written before world tick is enqueued on long rest

## 10. LLMModule Context Assembly

- [x] 10.1 Update `LLMModule` context assembly to call `MemoryService.getRecentDiaryEntries()` and inject the result into the prompt at cache breakpoint 3 (after world state, before session history)
- [x] 10.2 Ensure breakpoint 3 cache is invalidated when a new `DiaryEntry` is created (diary content changes trigger rebuild)
- [x] 10.3 Write unit tests for context assembly: diary entries included at breakpoint 3, missing entries skipped without error, new entry causes breakpoint 3 rebuild

## 11. Integration Tests

- [x] 11.1 Write integration test: `take_long_rest` creates a `DiaryEntry` record in the database for the active campaign
- [x] 11.2 Write integration test: `record_memory` tool call persists a `Memory` record with correct `subjectType`
- [x] 11.3 Write integration test: `search_memories` returns results from both tables ranked by similarity
- [x] 11.4 Write integration test: `search_memories` falls back to full-text when no vector results exist
