# session-and-llm Specification

## Purpose
TBD - created by archiving change character-inner-monologue. Update Purpose after archive.
## Requirements
### Requirement: INNER_VOICE chunk type added to DmStreamChunkType
`DmStreamChunkType` SHALL include an `INNER_VOICE` member. `INNER_VOICE` chunks SHALL carry monologue text in the existing `text` field of `DmStreamChunk`. No new fields are added to the DTO.

#### Scenario: INNER_VOICE chunk is valid in the GraphQL subscription
- **WHEN** the stream emits a chunk with `type: INNER_VOICE` and a `text` value
- **THEN** the GraphQL subscription resolves it without validation error

### Requirement: ContextLoader world block includes ability scores, proficiencies, race, and class
`ContextLoader.loadWorldBlock` SHALL include the character's full ability scores (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA` with computed modifiers), skill proficiencies, race name, and class name in the character sheet section. These SHALL be present whenever a `characterId` is supplied, alongside the existing HP, AC, conditions, and spell slots.

#### Scenario: Ability scores present in world block
- **WHEN** `loadWorldBlock` is called with a valid `characterId`
- **THEN** the returned string includes all six ability scores with their modifiers

#### Scenario: Race and class present in world block
- **WHEN** `loadWorldBlock` is called with a valid `characterId`
- **THEN** the returned string includes the character's race name and class name

### Requirement: DmOrchestrator invokes InnerMonologueService post-turn
`DmOrchestrator.runTurn` SHALL call `InnerMonologueService.runIfApplicable` after `runToolLoop` resolves and before emitting the main `DONE` chunk. The main `DONE` chunk SHALL be emitted first; `runIfApplicable` fires after it.

#### Scenario: Orchestrator sequence is correct
- **WHEN** a DM turn completes in an eligible scene
- **THEN** `runToolLoop` resolves → main `DONE` emitted → `runIfApplicable` called → `INNER_VOICE` chunks emitted → second `DONE` emitted

#### Scenario: InnerMonologueService failure does not break the turn
- **WHEN** `runIfApplicable` throws an error
- **THEN** the error is logged and the turn is considered complete; the main `DONE` has already been emitted

