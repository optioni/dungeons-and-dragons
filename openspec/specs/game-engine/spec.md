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

### Requirement: Death saves track progress toward stabilisation or death
The system SHALL expose a `roll_death_save` tool that accepts `characterId`. It SHALL roll 1d20: a natural 20 restores the character to 1 HP immediately; a 10 or higher increments `deathSaveSuccesses`; below 10 increments `deathSaveFailures`; a natural 1 increments `deathSaveFailures` by 2. Three successes result in stabilisation; three failures result in death (`Character.isDead = true`). After setting `isDead = true`, the tool handler SHALL check `campaign.deathMode`; if `PERMADEATH`, it SHALL initiate the permadeath end sequence (memorial diary write + campaign closure + `CAMPAIGN_ENDED` chunk).

#### Scenario: Three successes stabilise the character
- **WHEN** `roll_death_save` is called and the character accumulates 3 successes
- **THEN** the tool sets `Character.hp = 1`, resets both counters, and returns `{ outcome: "STABILISED" }`

#### Scenario: Three failures kill the character in STORY mode
- **WHEN** `roll_death_save` is called and the character accumulates 3 failures and `campaign.deathMode === STORY`
- **THEN** the tool sets `Character.isDead = true` and returns `{ outcome: "DEAD" }` without ending the campaign

#### Scenario: Three failures in PERMADEATH mode triggers campaign end
- **WHEN** `roll_death_save` is called and the character accumulates 3 failures and `campaign.deathMode === PERMADEATH`
- **THEN** the tool sets `Character.isDead = true`, initiates the permadeath end sequence, and returns `{ outcome: "DEAD", campaignEnded: true }`

#### Scenario: Natural 20 immediately revives the character
- **WHEN** the death save roll is a natural 20
- **THEN** `Character.hp` is set to 1, both counters reset, and the tool returns `{ outcome: "STABILISED", natural20: true }`

#### Scenario: Natural 1 counts as two failures
- **WHEN** the death save roll is a natural 1
- **THEN** `deathSaveFailures` increments by 2

### Requirement: Instant death and manual stabilisation bypass the death save loop
The system SHALL expose `instant_death` and `stabilise` tools. `instant_death` accepts `characterId` and sets `Character.isDead = true` and `Character.hp = 0` without requiring accumulated failures — used for massive damage or narrative death. After setting `isDead = true`, the tool handler SHALL check `campaign.deathMode`; if `PERMADEATH`, it SHALL initiate the permadeath end sequence. `stabilise` accepts `characterId`, sets `Character.hp = 1`, and resets both death save counters — used when an NPC provides aid mid-combat.

#### Scenario: Instant death bypasses death saves in STORY mode
- **WHEN** the LLM calls `instant_death` on a downed character and `campaign.deathMode === STORY`
- **THEN** `Character.isDead` is set to `true` without checking death save counters and the campaign remains ACTIVE

#### Scenario: Instant death in PERMADEATH mode triggers campaign end
- **WHEN** the LLM calls `instant_death` on a downed character and `campaign.deathMode === PERMADEATH`
- **THEN** `Character.isDead` is set to `true` and the permadeath end sequence is initiated

#### Scenario: Stabilise revives a downed character
- **WHEN** the LLM calls `stabilise` on a character at 0 HP
- **THEN** `Character.hp` is set to 1 and both death save counters reset to 0

### Requirement: end_campaign LLM tool concludes a campaign
The system SHALL register an `end_campaign` tool in `GameEngineModule` with parameters `campaignId: string`, `reason: string`, and `epitaph: string`. When called, the tool SHALL set `campaign.status = ENDED`, persist `endedAt` and `endReason`, force-end the active `GameSession`, and emit a `CAMPAIGN_ENDED` STATUS chunk into the DM SSE stream. The tool SHALL return a structured success result so the LLM can narrate the conclusion.

#### Scenario: LLM calls end_campaign for story conclusion
- **WHEN** the LLM invokes `end_campaign` with a valid `campaignId`, `reason`, and `epitaph`
- **THEN** the campaign's `status` is set to `ENDED`, `endedAt` is stamped, and `endReason` is persisted

#### Scenario: Active session is terminated on campaign end
- **WHEN** `end_campaign` succeeds
- **THEN** the active `GameSession` for that campaign has its `endedAt` set, preventing further player input

#### Scenario: CAMPAIGN_ENDED chunk is emitted
- **WHEN** `end_campaign` succeeds
- **THEN** a STATUS chunk with type `CAMPAIGN_ENDED`, the `epitaph` string, and a `stats` object (`daysPlayed`, `questsCompleted`) is emitted into the SSE stream before the tool result is returned

#### Scenario: Calling end_campaign on an already-ended campaign returns a structured error
- **WHEN** `end_campaign` is called for a campaign whose `status` is already `ENDED`
- **THEN** the tool returns a structured error result (not an exception) the LLM can acknowledge in narrative

#### Scenario: end_campaign is available in STORY and PERMADEATH modes
- **WHEN** the DM session is active for any campaign regardless of `deathMode`
- **THEN** `end_campaign` appears in the available tool set and can be invoked by the LLM

### Requirement: CAMPAIGN_ENDED is a valid DmStreamChunkType
The system SHALL add `CAMPAIGN_ENDED` to the `DmStreamChunkType` enum. The chunk payload SHALL include `epitaph: string`, `daysPlayed: number`, and `questsCompleted: number`.

#### Scenario: CAMPAIGN_ENDED chunk has required payload fields
- **WHEN** a `CAMPAIGN_ENDED` chunk is constructed
- **THEN** it carries non-null `epitaph`, `daysPlayed`, and `questsCompleted` fields

#### Scenario: Frontend SSE handler recognises CAMPAIGN_ENDED chunk type
- **WHEN** the SSE stream emits a chunk with type `CAMPAIGN_ENDED`
- **THEN** the frontend handler routes it to the campaign-end transition logic

### Requirement: trigger_level_up emits a level-up pause signal after its existing work
The system SHALL continue to perform the existing `trigger_level_up` behavior and SHALL additionally emit a `STATUS` chunk with `status = "LEVEL_UP_PENDING"` for the active DM stream after the tool succeeds.

#### Scenario: trigger_level_up emits LEVEL_UP_PENDING after success
- **WHEN** `trigger_level_up` succeeds for a character in an active DM session
- **THEN** the runtime emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"` before returning control to the client

### Requirement: Game engine tools may trigger stream-only UI side effects
The game engine SHALL support tool handlers whose primary purpose is to emit DM stream chunks for the client UI rather than mutate durable game state. These tools SHALL still return structured success or error envelopes.

#### Scenario: Stream-side effect tools return structured success
- **WHEN** a stream-side effect tool such as `trigger_spell_prep` completes successfully
- **THEN** it returns a structured success result and emits the corresponding DM stream chunk without throwing an exception

### Requirement: Successful player-relevant tool results map to visible mechanical events
The game engine orchestration layer SHALL map successful player-relevant tool results into normalized player-visible mechanical events after preserving the raw `TOOL_CALL` event. Eligible mappings SHALL include combat effects, inventory changes, resource use, quest progress, travel, discovery, and dungeon movement when the character directly experiences or observes the result.

#### Scenario: Combat tool maps to visible event
- **WHEN** `apply_damage`, `heal`, `apply_condition`, `remove_condition`, `roll_death_save`, `instant_death`, `start_combat`, or `end_combat` succeeds with a player-observable result
- **THEN** the orchestration layer maps the result into a `COMBAT` player-visible mechanical event

#### Scenario: Inventory tool maps to visible event
- **WHEN** `give_item`, `take_item`, `buy_item`, `sell_item`, `equip_item`, or `unequip_item` succeeds for an item the player can observe
- **THEN** the orchestration layer maps the result into an `INVENTORY` player-visible mechanical event

#### Scenario: Quest tool maps to visible event
- **WHEN** `create_quest`, `update_quest_objective`, `complete_quest`, or `fail_quest` succeeds for a quest visible to the player
- **THEN** the orchestration layer maps the result into a `QUEST` player-visible mechanical event

#### Scenario: Travel or discovery tool maps to visible event
- **WHEN** `travel_to`, `discover_location`, player-witnessed `create_location`, `enter_dungeon`, `exit_dungeon`, or player-directed `move_to_room` succeeds
- **THEN** the orchestration layer maps the result into a `TRAVEL` or `DISCOVERY` player-visible mechanical event as appropriate

### Requirement: Visible event mapping is conservative and player-safe
The game engine orchestration layer SHALL emit no player-visible mechanical event when a tool result is failed, internal, hidden, or lacks enough player-safe data for a deterministic summary. The mapper SHALL NOT infer player-visible facts from hidden tool inputs when the structured result does not expose a safe player-facing summary.

#### Scenario: Internal context tool does not map
- **WHEN** `record_memory`, `search_memories`, `record_npc_memory`, or another context-only tool succeeds
- **THEN** no player-visible mechanical event is produced

#### Scenario: Hidden world state tool does not map by default
- **WHEN** an unrevealed faction, agenda, antagonist, lore, or world-simulation tool succeeds off-screen
- **THEN** no player-visible mechanical event is produced unless the result explicitly represents something the player witnesses

#### Scenario: Insufficient safe data produces no event
- **WHEN** a successful tool result lacks enough player-safe fields to form a visible event title or summary
- **THEN** the mapper produces no player-visible mechanical event rather than guessing from raw hidden inputs

