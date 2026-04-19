# In-Game Day Counter

## Purpose

Defines a monotonic integer day counter that serves as the authoritative source of truth for all time-relative ordering in the system, replacing narrative date strings for logical comparisons and scheduling.

## Requirements

### Requirement: Campaign tracks a monotonic integer day counter
The `Campaign` entity SHALL have an `inGameDay: integer` field (database column `in_game_day`, NOT NULL, default 1). `inGameDay` SHALL be the authoritative source of truth for all time-relative ordering in the system. The existing `inGameDate` string field SHALL be retained for display and narrative purposes only; all comparisons SHALL use `inGameDay`.

#### Scenario: New campaign starts at day 1
- **WHEN** a new campaign's world seed is persisted
- **THEN** `Campaign.inGameDay` is set to `1`

#### Scenario: inGameDay is a plain integer, not a timestamp
- **WHEN** two campaigns have `inGameDay = 14`
- **THEN** they compare equal regardless of wall-clock time or calendar format
