# Semantic Search Spec

## Purpose

Defines how the system performs semantic similarity search across diary entries and memory facts via the `search_memories` LLM tool, including full-text fallback and the unified `MemoryService` search interface.

## Requirements

### Requirement: search_memories tool searches diary entries and memory facts by semantic similarity
The system SHALL register a `search_memories(query, subjectType?, subjectId?, limit?)` tool in the tool registry. When invoked, the system SHALL generate an embedding for `query` via Voyage AI, perform cosine similarity search (`<=>` operator) across both `DiaryEntry` and `Memory` tables for the active campaign, merge the results, and return the top-N records ordered by similarity score descending. Default `limit` is 5; maximum is 20.

#### Scenario: Query returns results from both tables
- **WHEN** the LLM invokes `search_memories` with a query that matches both diary entries and memory facts
- **THEN** the result set includes records from both `DiaryEntry` and `Memory`, merged and ranked by similarity score

#### Scenario: subjectType filter narrows results
- **WHEN** the LLM invokes `search_memories` with `subjectType: 'npc'`
- **THEN** only `Memory` records with `subjectType = 'npc'` are included; diary entries are excluded from results

#### Scenario: subjectId filter narrows results to a specific entity
- **WHEN** the LLM invokes `search_memories` with both `subjectType` and `subjectId`
- **THEN** only `Memory` records matching both fields are included in the candidate set

#### Scenario: Limit is respected
- **WHEN** the LLM invokes `search_memories` with `limit: 3` and more than 3 matching records exist
- **THEN** the tool returns at most 3 records

### Requirement: Full-text fallback activates when vector search yields no results
When the cosine similarity search returns zero results — or when the Voyage AI embedding call fails — the system SHALL fall back to PostgreSQL full-text search using `tsvector`/`tsquery` on the `content` column of both tables.

#### Scenario: No vector results triggers full-text fallback
- **WHEN** the embedding search returns zero candidates for the active campaign
- **THEN** the system runs a full-text query against both tables and returns the matching records

#### Scenario: Voyage AI failure triggers full-text fallback
- **WHEN** the Voyage AI SDK call throws an error during query embedding
- **THEN** the system logs the error, proceeds with full-text search, and returns results without surfacing the embedding error to the LLM

#### Scenario: No results from either search returns empty list
- **WHEN** both vector and full-text search return zero results
- **THEN** the tool returns an empty array and a structured success result (the LLM narrates that nothing relevant was found)

### Requirement: DiaryEntry and Memory tables expose tsvector columns for full-text search
Both `DiaryEntry` and `Memory` tables SHALL include a `tsvector` column (`search_vector`) populated by a `BEFORE INSERT OR UPDATE` trigger using `to_tsvector('english', content)`.

#### Scenario: Full-text column populated on insert
- **WHEN** a new `DiaryEntry` or `Memory` record is inserted with non-empty content
- **THEN** the `search_vector` column is populated automatically by the database trigger

#### Scenario: Full-text column updated on content change
- **WHEN** the `content` column of an existing record is updated
- **THEN** the `search_vector` column is recalculated by the trigger

### Requirement: MemoryService exposes a unified search method
`MemoryService` SHALL provide a `searchMemories(campaignId, query, options?)` method that encapsulates the embedding call, parallel pgvector queries, merge logic, and full-text fallback. Callers SHALL not interact with Voyage AI or pgvector directly.

#### Scenario: Callers receive a typed result list
- **WHEN** `searchMemories` is called with a campaign ID and query string
- **THEN** it returns an array of typed result objects each containing the record type (`diary` | `fact`), content, subject metadata where applicable, and similarity score
