## MODIFIED Requirements

### Requirement: Tool execution uses a structured registry contract
The system SHALL execute LLM-requested tools through a registry that maps tool names to handlers. Every tool handler SHALL return a structured result envelope instead of throwing transport-layer errors. That envelope SHALL include whether the call succeeded and the data or error information required for the narrative to recover gracefully. The `DmOrchestrator` SHALL select the tool registry based on `GameSession.sessionType`: `GameEngineToolRegistrar` for `PLAY` sessions and `SetupToolRegistrar` for `SETUP` sessions.

#### Scenario: Successful tool call returns structured result
- **WHEN** the DM runtime executes a valid supported tool call
- **THEN** the tool registry returns a structured success payload that is recorded in the session transcript and fed back into the turn

#### Scenario: Invalid tool arguments return structured failure
- **WHEN** the DM runtime executes a supported tool call with invalid arguments
- **THEN** the tool registry returns a structured error payload and the stream continues without crashing the subscription transport

#### Scenario: PLAY session uses GameEngineToolRegistrar
- **WHEN** the DM runtime begins a turn for a session with `sessionType = PLAY`
- **THEN** `GameEngineToolRegistrar` is loaded and only game engine tools are available to the LLM

#### Scenario: SETUP session uses SetupToolRegistrar
- **WHEN** the DM runtime begins a turn for a session with `sessionType = SETUP`
- **THEN** `SetupToolRegistrar` is loaded and only the four setup tools are available to the LLM

### Requirement: Scene prompt modules are loaded only for PLAY sessions
The system SHALL store prompt modules for `EXPLORATION`, `COMBAT`, `SOCIAL`, `SETTLEMENT`, and `REST` as application-managed text assets. The DM runtime SHALL load the module set corresponding to the active `GameSession.sceneType` for each `PLAY` turn. For `SETUP` sessions, no prompt modules SHALL be loaded.

#### Scenario: PLAY session with EXPLORATION scene type loads exploration module
- **WHEN** the active session has `sessionType = PLAY` and `sceneType = EXPLORATION`
- **THEN** the DM runtime includes the exploration prompt module in the assembled prompt

#### Scenario: SETUP session loads no prompt modules
- **WHEN** the active session has `sessionType = SETUP`
- **THEN** the DM runtime skips prompt module loading entirely and assembles the prompt without any scene module block

#### Scenario: Scene transition in a PLAY session swaps the loaded module
- **WHEN** a tool call updates the session scene from `EXPLORATION` to `COMBAT` during a PLAY session
- **THEN** the next DM turn includes combat prompt guidance instead of the exploration module
