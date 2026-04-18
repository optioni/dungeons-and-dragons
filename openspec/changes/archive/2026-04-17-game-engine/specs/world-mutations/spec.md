## ADDED Requirements

### Requirement: Location state is updated by LLM tool call
The system SHALL expose an `update_location_state` tool that accepts `locationId` and `state` (SAFE | TENSE | THREATENED | HOSTILE | RUINED). The tool SHALL update `Location.currentState` to the new value and return the updated location.

#### Scenario: Location state changes on valid input
- **WHEN** the LLM calls `update_location_state` with a valid locationId and state
- **THEN** `Location.currentState` is updated to the provided value

#### Scenario: Unknown location returns structured error
- **WHEN** the LLM calls `update_location_state` with a locationId that does not exist
- **THEN** the tool returns `{ success: false, reason: "LOCATION_NOT_FOUND" }`

### Requirement: Faction disposition toward the player shifts via tool call
The system SHALL expose a `shift_faction_disposition` tool that accepts `factionId` and `disposition` (ALLY | NEUTRAL | WARY | HOSTILE). The tool SHALL update `Faction.playerDisposition` and return the updated faction. The LLM is responsible for determining the appropriate disposition shift based on narrative events.

#### Scenario: Faction disposition updates to the provided value
- **WHEN** the LLM calls `shift_faction_disposition` with a valid factionId and disposition
- **THEN** `Faction.playerDisposition` is set to the new value

### Requirement: World events are created and resolved by LLM tool calls
The system SHALL expose `trigger_world_event` and `resolve_world_event` tools. `trigger_world_event` accepts `campaignId`, `description`, optional `locationId`, optional `deadlineInGameDate`, and `source` (PLAYER_ACTION | WORLD_TICK | CATASTROPHE). It SHALL persist a `WorldEvent` with `status: ACTIVE`. `resolve_world_event` accepts `worldEventId` and `outcome` text. It SHALL set `WorldEvent.status = RESOLVED` and store the outcome.

#### Scenario: Triggered world event is persisted as ACTIVE
- **WHEN** the LLM calls `trigger_world_event` with a description and source
- **THEN** a `WorldEvent` row with `status: ACTIVE` is created and its id returned

#### Scenario: Resolving a world event sets status and outcome
- **WHEN** the LLM calls `resolve_world_event` with a valid worldEventId and outcome text
- **THEN** `WorldEvent.status` is set to RESOLVED and `WorldEvent.outcome` stores the text

### Requirement: NPC state is updated by the game engine
The system SHALL expose an `update_npc` tool that accepts `npcId` and a partial `NpcUpdate` object (any subset of: `alive`, `disposition`, `currentLocationId`, `agenda`, `nextTickInGameDate`). The tool SHALL apply only the provided fields and return the updated NPC. After applying the update, the tool SHALL emit a `StateChangedEvent` with `type: 'NPC_UPDATE'` (or `type: 'NPC_KILLED'` if `alive` is set to `false`).

#### Scenario: NPC disposition update applies the change
- **WHEN** the LLM calls `update_npc` with `{ disposition: "HOSTILE" }`
- **THEN** `Npc.disposition` is updated to HOSTILE and other fields are unchanged

#### Scenario: Killing an NPC emits NPC_KILLED event
- **WHEN** the LLM calls `update_npc` with `{ alive: false }`
- **THEN** `Npc.alive` is set to false and a `StateChangedEvent` with `type: 'NPC_KILLED'` and `entityId: npcId` is emitted

#### Scenario: Partial update does not overwrite unspecified fields
- **WHEN** the LLM calls `update_npc` with only `{ currentLocationId: "..." }`
- **THEN** only `Npc.currentLocationId` changes; all other NPC fields remain as they were

### Requirement: NPCs join and leave the player party
The system SHALL expose `add_to_party` and `remove_from_party` tools. `add_to_party` accepts `npcId`, sets `Npc.partyStatus = COMPANION`, and sets `Npc.nextTickInGameDate = null` to suspend their independent world tick processing. `remove_from_party` accepts `npcId` and sets `Npc.partyStatus = NONE`.

#### Scenario: Adding NPC to party suspends their world tick
- **WHEN** the LLM calls `add_to_party` for a valid NPC
- **THEN** `Npc.partyStatus` is set to COMPANION and `Npc.nextTickInGameDate` is set to null

#### Scenario: Removing NPC from party restores their non-party status
- **WHEN** the LLM calls `remove_from_party` for a companion NPC
- **THEN** `Npc.partyStatus` is set to NONE

### Requirement: Scene type is updated by the LLM
The system SHALL expose a `set_scene_type` tool that accepts `sessionId` and `sceneType` (EXPLORATION | COMBAT | SOCIAL | SETTLEMENT | REST). The tool SHALL update `GameSession.sceneType`. This is used by the LLM to change the active dynamic prompt module and signal the frontend to adjust its scene-aware UI.

#### Scenario: Scene type updates the active session
- **WHEN** the LLM calls `set_scene_type` with a valid sessionId and sceneType
- **THEN** `GameSession.sceneType` is updated to the new value

### Requirement: Antagonist plan stages advance on LLM instruction
The system SHALL expose an `advance_antagonist_stage` tool that accepts `campaignId`. It SHALL mark the current active `AntagonistStage` as COMPLETED and set the next stage to IN_PROGRESS. If no further stage exists, the tool returns `{ finalStage: true }`. The server SHALL NOT auto-advance stages — only the LLM calls this tool when narrative events warrant it.

#### Scenario: Active antagonist stage is completed and next advances
- **WHEN** the LLM calls `advance_antagonist_stage` for a campaign with multiple pending stages
- **THEN** the current IN_PROGRESS stage is marked COMPLETED and the next PENDING stage becomes IN_PROGRESS

#### Scenario: Advancing past the last stage returns final stage signal
- **WHEN** the LLM calls `advance_antagonist_stage` and the current stage is the last one
- **THEN** the tool marks it COMPLETED and returns `{ finalStage: true }`

### Requirement: Lore facts are appended to the campaign document
The system SHALL expose a `record_lore` tool that accepts `campaignId` and `fact` (string). It SHALL append the fact as a new line to `Campaign.loreDocument`. This is used by the LLM to record established world facts — resolved mysteries, historical revelations, named locations' secrets — that should persist across sessions.

#### Scenario: Lore fact is appended to campaign document
- **WHEN** the LLM calls `record_lore` with a fact string
- **THEN** the fact is appended to `Campaign.loreDocument` and the updated document is returned

### Requirement: Catastrophes are triggered as low-probability world events
The system SHALL expose a `trigger_catastrophe` tool that accepts `campaignId`, `description`, and optional `locationId`. It SHALL persist a `WorldEvent` with `source: CATASTROPHE` and `status: ACTIVE`. The LLM calls this tool when narrative or world-tick logic dictates a catastrophic event — the server does not autonomously decide when catastrophes fire.

#### Scenario: Catastrophe creates an ACTIVE WorldEvent with source CATASTROPHE
- **WHEN** the LLM calls `trigger_catastrophe` with a description
- **THEN** a `WorldEvent` row with `source: CATASTROPHE` and `status: ACTIVE` is persisted and its id returned
