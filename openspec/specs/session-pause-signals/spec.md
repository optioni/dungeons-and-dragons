# session-pause-signals Specification

## Purpose
TBD - created by archiving change interactive-stream-signals. Update Purpose after archive.
## Requirements
### Requirement: DM stream status chunks signal pause-required player workflows
The DM stream SHALL use `STATUS` chunks with a `status` string to signal player workflows that temporarily pause freeform text play. The initial supported values SHALL include `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING`.

#### Scenario: Level-up workflow is signaled through the DM stream
- **WHEN** the game engine finishes the state changes associated with `trigger_level_up`
- **THEN** the active stream emits a `STATUS` chunk with `status = "LEVEL_UP_PENDING"`

#### Scenario: Spell preparation workflow is signaled through the DM stream
- **WHEN** the game engine executes `trigger_spell_prep` for a class that prepares spells
- **THEN** the active stream emits a `STATUS` chunk with `status = "SPELL_PREP_PENDING"`

### Requirement: Pause signals are transient stream events
Pause-required workflow signals SHALL be delivered through the live DM stream and SHALL NOT require a new persisted session pause field solely for these signals.

#### Scenario: Pause signals do not require new durable pause storage
- **WHEN** the system adds support for `LEVEL_UP_PENDING` and `SPELL_PREP_PENDING`
- **THEN** the implementation uses the existing DM stream contract without introducing a new database field dedicated only to pause-status persistence

