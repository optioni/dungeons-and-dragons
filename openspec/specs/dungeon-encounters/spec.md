# Dungeon Encounters Spec

## Purpose

Defines how the DM spawns encounters inside a dungeon — both keyed room encounters (pre-stocked per room) and wandering monster encounters drawn from a dungeon-level encounter table. Covers NPC materialization, encounter table mechanics, and the relationship between wandering monsters and room cleared state.

## Requirements

### Requirement: spawn_encounter tool materializes NPC entities from encounter specs
The system SHALL expose a `spawn_encounter(roomId?, dungeonId?, fromTable?)` LLM tool. When called with `roomId`, it SHALL find the `RoomEncounter` for that room, validate it is not cleared, and create `Npc` entities from each entry in `RoomEncounter.monsters`. When called with `dungeonId` and `fromTable: true`, it SHALL pick a weighted random entry from `Dungeon.encounterTable` and materialize NPCs from that entry. The tool SHALL return `npcIds` suitable for passing to `start_combat`. The tool SHALL fail if `activeDungeonId` is null.

#### Scenario: Keyed room encounter spawns NPCs from pre-stocked spec
- **WHEN** the DM calls `spawn_encounter(roomId)` for a room with a non-cleared `RoomEncounter`
- **THEN** `Npc` entities are created matching the `monsters` spec and their ids are returned in `npcIds`

#### Scenario: SRD monster spec populates NPC stats from SRD
- **WHEN** a monster spec in `RoomEncounter.monsters` has a valid `srdIndex`
- **THEN** the created `Npc` uses `hp` and `maxHp` from the `SrdMonster` stat block

#### Scenario: Custom monster spec uses provided HP
- **WHEN** a monster spec has no `srdIndex` but has an explicit `hp` value
- **THEN** the created `Npc` uses the provided `hp` as both `hp` and `maxHp`

#### Scenario: Invalid srdIndex returns structured error
- **WHEN** a monster spec references an `srdIndex` not found in the SRD cache
- **THEN** the tool returns `errorCode: MONSTER_NOT_FOUND` and no NPCs are created

#### Scenario: Cleared encounter cannot be spawned
- **WHEN** the DM calls `spawn_encounter(roomId)` for a room whose `RoomEncounter.cleared` is true
- **THEN** the tool returns `errorCode: ENCOUNTER_ALREADY_CLEARED`

#### Scenario: Wandering encounter spawns from dungeon encounter table
- **WHEN** the DM calls `spawn_encounter(dungeonId, fromTable: true)` and `encounterTable` is non-null
- **THEN** an entry is selected by weight and NPCs are materialized from that entry's `monsters` spec

#### Scenario: Wandering spawn from empty encounter table returns error
- **WHEN** the DM calls `spawn_encounter(dungeonId, fromTable: true)` and `encounterTable` is null
- **THEN** the tool returns `errorCode: NO_ENCOUNTER_TABLE`

### Requirement: Wandering monster NPCs do not affect room cleared state
The system SHALL NOT set `RoomEncounter.cleared` when a wandering encounter is spawned or defeated. Only keyed encounters tracked via `RoomEncounter` SHALL contribute to `roomState = CLEARED`.

#### Scenario: Defeating wandering monsters leaves room state unchanged
- **WHEN** NPCs spawned via `fromTable: true` are all killed
- **THEN** the current room's `roomState` remains at its pre-combat value

### Requirement: Spawned NPCs are created in the current campaign scope
All `Npc` entities created by `spawn_encounter` SHALL have `campaignId` set to the session's campaign. They SHALL have `alive = true` and `partyStatus = NONE`. Their names SHALL be derived from the monster spec name (with a numeric suffix for multiples, e.g. "Goblin 1", "Goblin 2").

#### Scenario: Multiple monsters of the same type get distinct names
- **WHEN** a monster spec has `count: 3` and `name: "Goblin"`
- **THEN** three `Npc` rows are created with names "Goblin 1", "Goblin 2", "Goblin 3"
