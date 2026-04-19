## MODIFIED Requirements

### Requirement: NPC agendas are evaluated lazily based on in-game day
The system SHALL evaluate an NPC's agenda only when `Npc.nextTickInGameDay` is less than or equal to `Campaign.inGameDay`. NPCs whose `nextTickInGameDay` has not yet passed SHALL be skipped entirely in that tick. The current `Campaign.inGameDay` integer SHALL be provided explicitly in each Haiku prompt so the model can determine whether the agenda is due.

#### Scenario: Overdue NPC is evaluated
- **WHEN** a tick runs and an NPC's `nextTickInGameDay` is less than or equal to `Campaign.inGameDay`
- **THEN** that NPC's agenda is included in the Haiku evaluation batch

#### Scenario: Future-dated NPC is skipped
- **WHEN** a tick runs and an NPC's `nextTickInGameDay` is greater than `Campaign.inGameDay`
- **THEN** that NPC is not evaluated and its `agenda` and `nextTickInGameDay` remain unchanged

#### Scenario: NPC with no nextTickInGameDay is skipped
- **WHEN** a tick runs and an NPC has `nextTickInGameDay = null`
- **THEN** that NPC is not evaluated in the agenda step

### Requirement: Agenda evaluation produces structured outcomes per NPC
The system SHALL call Haiku once per NPC (or per independent batch) with that NPC's targeted context: name, profession, personality, current location, agenda, and current `Campaign.inGameDay`. Haiku SHALL return a structured outcome containing: updated `agenda` text, updated `nextTickInGameDay` as an integer (current day + N offset), optional `newLocationId`, and optional narrative consequence text. The system SHALL collect these outcomes for atomic application at the end of the tick.

#### Scenario: Haiku returns updated agenda and next tick day
- **WHEN** Haiku evaluates an NPC's agenda
- **THEN** the outcome includes a new `agenda` string and a new `nextTickInGameDay` integer offset from the current `Campaign.inGameDay`

#### Scenario: Haiku returns a location change for a travelling NPC
- **WHEN** Haiku determines the NPC's agenda requires them to move to a different location
- **THEN** the outcome includes a `newLocationId` referencing a valid `Location` in the same campaign

#### Scenario: Outcome with no location change leaves currentLocationId unchanged
- **WHEN** Haiku returns an outcome with no `newLocationId`
- **THEN** `Npc.currentLocationId` is not modified during outcome application

### Requirement: NPC entity stores nextTickInGameDay as a nullable integer
The `Npc` entity SHALL have `nextTickInGameDay: number | null` (database column `next_tick_in_game_day`, INTEGER, nullable). The former `nextTickInGameDate: string | null` field SHALL be removed. A `null` value means the NPC has no scheduled tick and SHALL be skipped by `getDueNpcs`.

#### Scenario: Null nextTickInGameDay excludes NPC from getDueNpcs
- **WHEN** getDueNpcs runs and an NPC has nextTickInGameDay = null
- **THEN** that NPC is not returned in the result set

#### Scenario: Integer comparison correctly orders overdue NPCs
- **WHEN** NPC A has nextTickInGameDay = 3 and NPC B has nextTickInGameDay = 7 and Campaign.inGameDay = 10
- **THEN** both are returned as due, ordered with NPC A first (lower value = more overdue)
