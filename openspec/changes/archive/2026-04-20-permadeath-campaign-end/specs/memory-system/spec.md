## MODIFIED Requirements

### Requirement: DiaryEntry entity stores a Haiku-written narrative summary per in-game day
The system SHALL persist a `DiaryEntry` record for each in-game day that ends via `take_long_rest`. Each entry SHALL store the campaign ID, the in-game date string, narrative content (max 1000 characters), a pgvector embedding of that content, a creation timestamp, and an `entryType` field (enum: `DAILY` | `MEMORIAL`, default `DAILY`).

#### Scenario: Diary entry created on long rest
- **WHEN** the `take_long_rest` tool is executed for an active campaign
- **THEN** the system creates one `DiaryEntry` record with `entryType = DAILY` for the current in-game date before triggering the world tick

#### Scenario: Entry content is written by Claude Haiku
- **WHEN** the diary entry is being created
- **THEN** `MemoryService` calls Claude Haiku with the session's `GameEvent` records for that day and persists the resulting narrative text

#### Scenario: Entry content is capped at 1000 characters
- **WHEN** Haiku returns diary content longer than 1000 characters
- **THEN** the system truncates or rejects the content and persists at most 1000 characters

#### Scenario: Multiple long rests produce distinct entries
- **WHEN** `take_long_rest` is executed on separate in-game dates
- **THEN** each execution produces a separate `DiaryEntry` with a distinct `inGameDate` value

## ADDED Requirements

### Requirement: Memorial diary entry is written on permadeath
The system SHALL allow `DiaryService.writeDiaryEntry` to be called with `entryType = MEMORIAL` from the game engine's permadeath end sequence. A memorial entry SHALL be written by Claude Haiku using the campaign's full session transcript as context, summarising the character's life and cause of death. The memorial entry SHALL follow the same 1000-character limit and embedding pipeline as `DAILY` entries.

#### Scenario: Memorial entry is created with MEMORIAL entry type
- **WHEN** the permadeath end sequence calls `writeDiaryEntry` with `entryType = MEMORIAL`
- **THEN** a `DiaryEntry` with `entryType = MEMORIAL` is persisted for the campaign

#### Scenario: Memorial entry content summarises the character's arc
- **WHEN** Haiku writes the memorial entry
- **THEN** the content references the character's name, key events from the session transcript, and the cause of death

#### Scenario: Memorial entry follows the standard embedding pipeline
- **WHEN** the memorial diary entry is created
- **THEN** a Voyage AI embedding is generated and stored alongside the content

#### Scenario: Memorial entry failure does not block campaign end
- **WHEN** the Haiku memorial write call fails
- **THEN** the error is logged and the permadeath end sequence continues without a memorial diary entry
