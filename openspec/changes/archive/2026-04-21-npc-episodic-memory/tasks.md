## 1. NpcMemory entity and migration

- [x] 1.1 Create `apps/api/src/world/entities/npc-memory.entity.ts` with fields: `id`, `npcId` (integer FK), `content` (text, max 1000 chars), `embedding` (VectorType, nullable), `inGameDate` (text, nullable), `sourceNpcId` (integer, nullable), `createdAt` (timestamptz)
- [x] 1.2 Generate a MikroORM migration for the `npc_memory` table including a pgvector `embedding` column and an index on `npcId`
- [x] 1.3 Register `NpcMemory` as a repository in `WorldModule` via `MikroOrmModule.forFeature([NpcMemory])`

## 2. NpcMemoryService

- [x] 2.1 Create `apps/api/src/world/npc-memory.service.ts` and register it as a provider in `WorldModule`; import `MemoryModule` in `WorldModule` to gain access to `EmbeddingService`
- [x] 2.2 Implement `NpcMemoryService.createNpcMemory(npcId, content, inGameDate?, sourceNpcId?)` — creates the row, generates a Voyage AI embedding via `EmbeddingService`, persists and flushes
- [x] 2.3 Implement `NpcMemoryService.searchNpcMemories(npcId, query, limit)` — generates a query embedding, runs a pgvector cosine-similarity search scoped to `npcId`, returns results ordered by similarity
- [x] 2.4 Write unit tests for `createNpcMemory` (row created with embedding, sourceNpcId null when omitted, sourceNpcId set when provided)
- [x] 2.5 Write unit tests for `searchNpcMemories` (returns top-N by similarity, empty result when no memories exist, limit respected)

## 3. Config values

- [x] 3.1 Add `NPC_MEMORY_AGENDA_LIMIT` (default 5), `NPC_MEMORY_CONVERSATION_LIMIT` (default 3), and `NPC_MEMORY_SCENE_LIMIT` (default 10) to `apps/api/src/config/environment.validation.ts` with `@IsInt()` / `@Min(1)` validation and defaults

## 4. `record_npc_memory` DM session tool

- [x] 4.1 Register `record_npc_memory` in `GameEngineToolRegistrarService.registerMemoryTools()` — accepts `npc_id` (integer) and `content` (string); validates the NPC exists in the session's campaign; calls `NpcMemoryService.createNpcMemory`; returns `{ success: true, data: { id } }` or a structured error
- [x] 4.2 Write unit tests for `record_npc_memory`: success path creates memory and returns id; unknown `npc_id` returns `{ success: false, errorCode: "NPC_NOT_FOUND" }` without throwing

## 5. World-tick agenda evaluation enrichment

- [x] 5.1 In `WorldTickWorker.evaluateSingleNpcAgenda`, inject `NpcMemoryService` and fetch up to `NPC_MEMORY_AGENDA_LIMIT` memories for the NPC using its current `agenda` as the search query before building the Haiku prompt
- [x] 5.2 Extend the Haiku agenda prompt to include a `## Recent Memories` section when memories are present; omit the section when the NPC has no memories
- [x] 5.3 Write unit tests: agenda prompt includes memory section when memories exist; prompt omits memory section when none exist; memory count is capped at `NPC_MEMORY_AGENDA_LIMIT`

## 6. World-tick conversation shared memories

- [x] 6.1 Extend the `ConversationOutcome` interface with `sharedMemories: Array<{ receiverNpcId: number; content: string; senderNpcId: number }>`
- [x] 6.2 In `WorldTickWorker.runSingleConversation`, fetch up to `NPC_MEMORY_CONVERSATION_LIMIT` memories per participant and include them in the Haiku conversation prompt
- [x] 6.3 Extend the Haiku conversation response schema to include `sharedMemories` and parse it in `runSingleConversation`
- [x] 6.4 In `WorldTickWorker.applyOutcomes`, iterate `conv.sharedMemories` and call `NpcMemoryService.createNpcMemory` for each entry (receiverNpcId, content, inGameDate, senderNpcId) — these calls must be awaited before the final `em.flush()`
- [x] 6.5 Write unit tests: conversation outcome with `sharedMemories` entries creates `NpcMemory` rows for each receiver; empty `sharedMemories` creates no rows; shared memory `sourceNpcId` matches the sender

## 7. ContextLoader scene context enrichment

- [x] 7.1 Extend `ContextLoader.loadWorldBlock` to accept an optional `npcMemories: string` parameter and append it as a `## NPC Knowledge` section in the returned string when present
- [x] 7.2 In the `LLMModule` caller that invokes `loadWorldBlock`, fetch NPCs at the current session location, run `NpcMemoryService.searchNpcMemories` for each with the latest player input as the query, aggregate up to `NPC_MEMORY_SCENE_LIMIT` total results, format them as `<NpcName> remembers: <content>` lines, and pass the formatted string to `loadWorldBlock`
- [x] 7.3 Write unit tests for `loadWorldBlock`: NPC memory section is included when memories are provided; section is omitted when `npcMemories` is absent or empty
- [x] 7.4 Write unit tests for the caller aggregation: results are capped at `NPC_MEMORY_SCENE_LIMIT` across all NPCs; no error when no NPCs are at the location
