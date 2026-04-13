## Why

LLMs have finite context windows. A persistent campaign accumulates far more history than fits in a prompt. The memory system solves this: diary entries summarise each in-game day and the last 7 are injected automatically; memory facts capture discrete established details; both are semantically searchable via pgvector so the DM can retrieve relevant context on demand without loading everything.

## What Changes

- `DiaryEntry` entity — campaignId, inGameDate, content, embedding (vector), createdAt
- `Memory` entity — campaignId, subjectType, subjectId, content, embedding (vector), createdAt
- `MemoryModule` — diary write (Haiku) triggered by `take_long_rest`, memory fact creation, Voyage AI embedding generation, pgvector similarity search, PostgreSQL full-text fallback
- `search_memories` LLM tool — semantic search across diary entries and memory facts
- Last 7 diary entries injected at prompt cache breakpoint 3

## Capabilities

### New Capabilities
- `diary-system`: Haiku-written diary entries after each in-game day, pgvector embeddings, 7-day rolling prompt injection
- `memory-facts`: Discrete NPC/character memory facts with embeddings, created via LLM tool during play
- `semantic-search`: Voyage AI embedding generation, pgvector similarity search, PostgreSQL full-text fallback — unified via `search_memories` tool

### Modified Capabilities
- `llm-orchestration`: Adds diary entries to prompt context at cache breakpoint 3; adds `search_memories` to tool definitions

## Impact

- New `MemoryModule` in `api/`
- Depends on `session-and-llm`, `campaign-setup`
- `world-system` depends on `MemoryModule` to write diary before running world tick
- Requires Voyage AI API key and pgvector extension (already enabled in `srd-seed`)
