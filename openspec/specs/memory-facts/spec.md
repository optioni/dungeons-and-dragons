# Memory Facts Spec

## Purpose

Defines how the system stores and manages discrete established facts about NPCs, characters, locations, factions, items, and general lore via the `record_memory` LLM tool, including embedding generation for semantic retrieval.

## Requirements

### Requirement: Memory entity stores discrete established facts keyed to a subject
The system SHALL persist `Memory` records representing discrete facts established during play. Each record SHALL store the campaign ID, a `subjectType` enum value (`npc | character | location | faction | item | general`), a nullable `subjectId` (UUID of the referenced entity), content (max 1000 characters), a pgvector embedding, and a creation timestamp.

#### Scenario: Memory fact created with valid subject type
- **WHEN** the LLM invokes the `record_memory` tool with a valid `subjectType` and content
- **THEN** the system persists a `Memory` record with the provided values and returns a structured success result

#### Scenario: Memory fact created without a subject ID
- **WHEN** the LLM invokes `record_memory` with `subjectType: 'general'` and no `subjectId`
- **THEN** the system persists the record with a null `subjectId` without error

#### Scenario: Memory fact with invalid subject type returns structured failure
- **WHEN** the LLM invokes `record_memory` with an unrecognized `subjectType`
- **THEN** the tool returns a structured error result and no `Memory` record is persisted

### Requirement: Memory embedding is generated via Voyage AI
The system SHALL generate a 1024-dimensional embedding for each `Memory` content using the Voyage AI SDK (`voyage-3-large` model) and store it in the `embedding` column (pgvector `vector(1024)`).

#### Scenario: Embedding stored on creation
- **WHEN** a `Memory` record is created with non-empty content
- **THEN** the system calls Voyage AI to produce an embedding and persists it in the same operation

#### Scenario: Embedding failure does not block fact persistence
- **WHEN** the Voyage AI API call fails during memory creation
- **THEN** the system persists the `Memory` record with a null embedding and logs the error, returning a success result to the LLM

### Requirement: Memory records are cascade-deleted when their campaign is deleted
The system SHALL configure a cascade delete relationship so that all `Memory` records for a campaign are removed when the campaign is deleted.

#### Scenario: Campaign deletion removes associated memories
- **WHEN** a `Campaign` record is deleted
- **THEN** all `Memory` records with that `campaignId` are also deleted from the database

### Requirement: record_memory LLM tool is registered in the tool registry
The system SHALL register `record_memory(subjectType, subjectId?, content)` as a callable tool in the `GameEngineModule` tool registry. The tool SHALL delegate to `MemoryService.createMemory()` and return a structured result.

#### Scenario: Successful tool call acknowledged in session transcript
- **WHEN** the DM invokes `record_memory` with valid arguments
- **THEN** the tool result is recorded as a `GameEvent` in the session transcript with success status
