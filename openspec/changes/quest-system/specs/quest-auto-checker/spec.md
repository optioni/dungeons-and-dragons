## ADDED Requirements

### Requirement: Auto-checker runs after each state-changing tool call
The system SHALL invoke `QuestService.runAutoChecker(campaignId)` at the end of the `execute` handler for each of the following state-changing tools: `travel_to`, `apply_damage`, `give_item`, `update_npc`. The auto-checker SHALL run after the primary mutation is committed and SHALL NOT block or delay the tool's primary response.

#### Scenario: Auto-checker is invoked after travel_to
- **WHEN** the LLM calls `travel_to` and it succeeds
- **THEN** `runAutoChecker` is called with the campaign's id before the tool result is returned

#### Scenario: Auto-checker is invoked after apply_damage
- **WHEN** the LLM calls `apply_damage` and it succeeds
- **THEN** `runAutoChecker` is called with the campaign's id

#### Scenario: Auto-checker does not run when there are no active quests
- **WHEN** `runAutoChecker` is called for a campaign with no ACTIVE quests
- **THEN** the method returns immediately with no database writes and no notification

### Requirement: Auto-checker evaluates incomplete objectives against current world state
For each ACTIVE quest in the campaign, the auto-checker SHALL query `QuestObjective` rows with `status: INCOMPLETE` and evaluate them against the current world state using the following rules:

| Objective type | Completion condition |
|---|---|
| `REACH_LOCATION` | Character's current location id equals `QuestObjective.entityId` |
| `NPC_DEAD` | `Npc.alive` is false for the NPC with id `QuestObjective.entityId` |
| `NPC_ALIVE` | `Npc.alive` is true for the NPC with id `QuestObjective.entityId` |
| `HAVE_ITEM` | Character's inventory contains an item with id `QuestObjective.entityId` |
| `TALK_TO_NPC` | Always evaluated as `MANUAL` — not auto-checked |
| `MANUAL` | Never auto-checked — only completable via `update_quest_objective` |

When an objective's condition is met, the auto-checker SHALL update `QuestObjective.status` to `COMPLETE`.

#### Scenario: REACH_LOCATION objective completes when character arrives
- **WHEN** `travel_to` moves the character to a location that matches a REACH_LOCATION objective's entityId
- **THEN** `QuestObjective.status` is set to COMPLETE

#### Scenario: NPC_DEAD objective completes when NPC is killed
- **WHEN** `apply_damage` or `update_npc` sets an NPC's alive flag to false and that NPC is the target of a NPC_DEAD objective
- **THEN** `QuestObjective.status` is set to COMPLETE

#### Scenario: HAVE_ITEM objective completes when item enters inventory
- **WHEN** `give_item` adds an item to the character's inventory and that item matches a HAVE_ITEM objective's entityId
- **THEN** `QuestObjective.status` is set to COMPLETE

#### Scenario: MANUAL objective is never auto-checked
- **WHEN** a state-changing tool runs and there is an INCOMPLETE MANUAL objective
- **THEN** the auto-checker does not change that objective's status

### Requirement: Auto-checker signals the LLM when all objectives of a quest are complete
When the auto-checker marks the last INCOMPLETE objective of an ACTIVE quest as COMPLETE, the system SHALL append a `questCompleted` signal to the tool's `ToolResult`. The signal SHALL include the `questId` and `questTitle`. The LLM uses this signal to decide when to call `complete_quest`.

The auto-checker SHALL NOT directly set `Quest.status` to COMPLETED — that is reserved for the explicit `complete_quest` tool call.

#### Scenario: questCompleted signal is returned when all objectives finish
- **WHEN** the auto-checker marks the last incomplete objective of an active quest as COMPLETE
- **THEN** the enclosing tool result includes `{ questCompleted: { questId, questTitle } }`

#### Scenario: LLM retains narrative control — quest not auto-closed
- **WHEN** `questCompleted` appears in the tool result
- **THEN** `Quest.status` remains ACTIVE until the LLM explicitly calls `complete_quest`

#### Scenario: No signal when objectives remain incomplete
- **WHEN** the auto-checker completes some but not all objectives of a quest
- **THEN** no `questCompleted` signal is added to the tool result

### Requirement: Auto-checker query is bounded by campaign scope and indexed
The auto-checker SHALL query only the `QuestObjective` rows belonging to ACTIVE quests of the current campaign. The query SHALL use the composite indexes on `quest(campaign_id, status)` and `quest_objective(quest_id, status)`.

#### Scenario: Auto-checker query is scoped to campaign
- **WHEN** `runAutoChecker` runs for campaign A
- **THEN** it does not evaluate or modify objectives belonging to campaign B's quests
