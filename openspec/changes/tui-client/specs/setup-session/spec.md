## ADDED Requirements

### Requirement: SETUP session type supports conversational campaign and character creation
The system SHALL support a `SETUP` session type for `GameSession`. A `SETUP` session SHALL have no `sceneType` and SHALL not load dynamic prompt modules. The DM SHALL drive campaign concept selection, world seed generation, and character creation via tool calls within the SETUP session. On `confirm_character`, the session SHALL transition to `PLAY`.

#### Scenario: SETUP session starts without a scene type
- **WHEN** a `SETUP` session is created
- **THEN** `GameSession.sceneType` is null and no prompt modules are loaded for that session's DM turns

#### Scenario: SETUP session transitions to PLAY on confirm_character
- **WHEN** the DM calls `confirm_character` within a SETUP session
- **THEN** `GameSession.sessionType` is updated to `PLAY` and subsequent turns use the full play orchestration path

### Requirement: Setup tool registry provides four idempotent tools
The system SHALL expose a `SetupToolRegistrar` with four tools available only during `SETUP` sessions: `select_story_concept`, `confirm_world_seed`, `create_character`, and `confirm_character`. `create_character` SHALL be idempotent — calling it again during SETUP replaces the draft character without error.

#### Scenario: select_story_concept records the chosen story concept
- **WHEN** the DM calls `select_story_concept` with a concept identifier during a SETUP session
- **THEN** the chosen concept is persisted on the campaign and a structured success result is returned to the LLM

#### Scenario: confirm_world_seed locks the generated world seed
- **WHEN** the DM calls `confirm_world_seed` during a SETUP session
- **THEN** the world seed data is persisted on the campaign and a structured success result is returned

#### Scenario: create_character draft is idempotent
- **WHEN** the DM calls `create_character` with character data during a SETUP session and a draft already exists
- **THEN** the draft is replaced with the new data and a structured success result is returned without creating a duplicate

#### Scenario: confirm_character locks the character and transitions session type
- **WHEN** the DM calls `confirm_character` during a SETUP session
- **THEN** the draft character is locked, `GameSession.sessionType` is set to `PLAY` before the tool result is returned, and the result includes the confirmed character identifier

### Requirement: SETUP session tools are not available in PLAY sessions
The system SHALL ensure that setup tools (`select_story_concept`, `confirm_world_seed`, `create_character`, `confirm_character`) are not registered or callable during `PLAY` sessions.

#### Scenario: Setup tool call in a PLAY session returns structured failure
- **WHEN** the DM attempts to call `create_character` during a PLAY session
- **THEN** the tool registry returns a structured failure indicating the tool is not available in this session type

### Requirement: Campaign generation is invoked internally by setup tool handlers
The `generateCampaignStoryConcepts` and `generateCampaignWorldSeed` service methods SHALL be callable by `select_story_concept` and `confirm_world_seed` tool handlers respectively, in addition to their existing GraphQL mutation paths. No new service methods are required.

#### Scenario: select_story_concept handler calls generateCampaignStoryConcepts
- **WHEN** `select_story_concept` is invoked during a SETUP session
- **THEN** the handler calls `CampaignService.generateCampaignStoryConcepts` with the appropriate parameters and returns its result as the tool payload

#### Scenario: confirm_world_seed handler calls generateCampaignWorldSeed
- **WHEN** `confirm_world_seed` is invoked during a SETUP session
- **THEN** the handler calls `CampaignService.generateCampaignWorldSeed` and returns its result as the tool payload

### Requirement: SETUP session has no scene type or prompt modules
The LLM orchestration layer SHALL skip scene module loading when the active session is a SETUP session. No scene type SHALL be written to or read from a SETUP session row.

#### Scenario: SETUP session DM turn omits prompt modules
- **WHEN** the DM runtime assembles the prompt for a SETUP session turn
- **THEN** no scene prompt module block is included in the assembled prompt

#### Scenario: set_scene_type is not available during SETUP
- **WHEN** the DM attempts to call `set_scene_type` during a SETUP session
- **THEN** the tool is not registered and the call returns a structured failure
