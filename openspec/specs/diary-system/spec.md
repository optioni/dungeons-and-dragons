# Diary System Spec

## Purpose

Defines how the system creates and stores per-day narrative diary entries written by Claude Haiku at the end of each in-game day, including embedding generation for semantic retrieval.

## Requirements

### Requirement: DiaryEntry entity stores a Haiku-written narrative summary per in-game day
The system SHALL persist a `DiaryEntry` record for each in-game day that ends via `take_long_rest`. Each entry SHALL store the campaign ID, the in-game date string, narrative content (max 1000 characters), a pgvector embedding of that content, and a creation timestamp.

#### Scenario: Diary entry created on long rest
- **WHEN** the `take_long_rest` tool is executed for an active campaign
- **THEN** the system creates one `DiaryEntry` record for the current in-game date before triggering the world tick

#### Scenario: Entry content is written by Claude Haiku
- **WHEN** the diary entry is being created
- **THEN** `MemoryService` calls Claude Haiku with the session's `GameEvent` records for that day and persists the resulting narrative text

#### Scenario: Entry content is capped at 1000 characters
- **WHEN** Haiku returns diary content longer than 1000 characters
- **THEN** the system truncates or rejects the content and persists at most 1000 characters

#### Scenario: Multiple long rests produce distinct entries
- **WHEN** `take_long_rest` is executed on separate in-game dates
- **THEN** each execution produces a separate `DiaryEntry` with a distinct `inGameDate` value

### Requirement: DiaryEntry embedding is generated via Voyage AI
The system SHALL generate a 1024-dimensional vector embedding for each `DiaryEntry` content using the Voyage AI SDK (`voyage-3-large` model) and store it in the `embedding` column (pgvector `vector(1024)`).

#### Scenario: Embedding stored on creation
- **WHEN** a `DiaryEntry` is created with non-empty content
- **THEN** the system calls Voyage AI to produce an embedding and persists it alongside the content in the same transaction

#### Scenario: Embedding failure does not block diary persistence
- **WHEN** the Voyage AI API call fails during diary creation
- **THEN** the system persists the diary entry with a null embedding and logs the error, allowing the world tick to continue

### Requirement: Last 7 diary entries are retrievable for prompt injection
`MemoryService` SHALL expose a method that returns the 7 most recent `DiaryEntry` records for a given campaign, ordered by `inGameDate` descending, for use by `LLMModule` at context assembly time.

#### Scenario: Fewer than 7 entries exist
- **WHEN** a campaign has fewer than 7 diary entries
- **THEN** the method returns all available entries without error

#### Scenario: Entries ordered by in-game date descending
- **WHEN** multiple diary entries exist for a campaign
- **THEN** the 7 returned entries are ordered most-recent-first
