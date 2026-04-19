## MODIFIED Requirements

### Requirement: NPC agenda cap limits Haiku calls per tick
The system SHALL process at most `maxNpcsPerTick` NPCs per tick (default 10, configurable via `ConfigService`). When more NPCs are due, the system SHALL prioritise by most-overdue `nextTickInGameDay` (lowest integer value first). NPCs not processed in a given tick remain eligible and will be prioritised in subsequent ticks.

#### Scenario: Only the most-overdue NPCs are processed when cap is reached
- **WHEN** a campaign has 15 NPCs with overdue agendas and `maxNpcsPerTick` is 10
- **THEN** the 10 NPCs with the lowest `nextTickInGameDay` are processed and the remaining 5 retain their current `nextTickInGameDay` for the next tick

#### Scenario: All due NPCs are processed when count is within cap
- **WHEN** a campaign has 6 NPCs with overdue agendas and `maxNpcsPerTick` is 10
- **THEN** all 6 NPCs are evaluated in the agenda step

### Requirement: Worker handles a campaign with no due NPCs gracefully
The system SHALL handle the case where no NPC has `nextTickInGameDay <= campaign.inGameDay`. In this case the agenda and conversation steps SHALL produce no outcomes, the flush SHALL be a no-op, the catastrophe roll SHALL still run, and a diary entry SHALL still be written.

#### Scenario: Worker handles a campaign with no due NPCs gracefully
- **WHEN** a `world-tick` job runs for a campaign where no NPC has `nextTickInGameDay <= campaign.inGameDay`
- **THEN** the agenda and conversation steps produce no outcomes, the flush is a no-op, the catastrophe roll still runs, and a diary entry is still written
