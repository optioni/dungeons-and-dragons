# Game Engine

## Purpose

Defines the core LLM tool registration and execution framework for the D&D game engine. This spec covers the tool registrar architecture, quest integration, and state-changing tool result shapes.

## Requirements

### Requirement: GameEngineToolRegistrar accepts QuestService as a dependency
The system SHALL inject `QuestService` into `GameEngineToolRegistrar`. The registrar SHALL call `QuestService.runAutoChecker(campaignId)` at the end of the `execute` handler for each state-changing tool.

#### Scenario: QuestService is injected into GameEngineToolRegistrar
- **WHEN** `GameEngineModule` is initialised
- **THEN** `GameEngineToolRegistrar` receives a `QuestService` instance via constructor injection

#### Scenario: State-changing tool execute handlers call the auto-checker
- **WHEN** any of `travel_to`, `apply_damage`, `give_item`, or `update_npc` completes its primary mutation
- **THEN** `runAutoChecker(campaignId)` is called before the `ToolResult` is returned

### Requirement: State-changing tool results may carry a questCompleted signal
The system SHALL define a `questCompleted` field on the `ToolResult` union/type that state-changing tools can populate. When `QuestService.runAutoChecker` returns a completion signal, the registrar SHALL merge it into the tool result before returning.

#### Scenario: Tool result includes questCompleted when auto-checker signals completion
- **WHEN** `runAutoChecker` returns `{ questId, questTitle }` for a fully completed quest
- **THEN** the enclosing tool's `ToolResult` includes `{ questCompleted: { questId, questTitle } }`

#### Scenario: Tool result has no questCompleted field when no quest completes
- **WHEN** `runAutoChecker` detects no fully completed quest
- **THEN** the tool result does not include a `questCompleted` field
