## Why

`inGameDate` on `Campaign` and `nextTickInGameDate` on `Npc` are narrative strings (e.g. `"Day 14, Month of Frost"`). The world tick queries NPCs whose `nextTickInGameDate <= now`, but string comparison of narrative dates is meaningless and silently produces wrong ordering. This is a latent bug affecting every world tick since NPCs may fire out of order or never fire at all.

## What Changes

- `Campaign` gains `inGameDay: integer` — a monotonic day counter starting at 1, incremented by `take_long_rest`. The narrative `inGameDate` string is kept for display but `inGameDay` is the source of truth for all comparisons.
- `Npc.nextTickInGameDate` (string) replaced by `Npc.nextTickInGameDay: integer | null` — world tick queries `nextTickInGameDay <= campaign.inGameDay`.
- `WorldTickWorker` updated to set `nextTickInGameDay` as an integer offset from `campaign.inGameDay` (e.g. current day + 1, + 3, etc.) rather than a narrative string.
- `take_long_rest` increments `campaign.inGameDay` by 1 alongside advancing the narrative date string.
- `CampaignSetupService` initialises `inGameDay = 1` during world seed.
- MikroORM migration: add `inGameDay` to `campaign`, replace `nextTickInGameDate` with `nextTickInGameDay` on `npc`.

## Capabilities

### New Capabilities
- `in-game-day-counter`: Monotonic integer day counter on Campaign, used as the authoritative ordering signal for all time-relative logic.

### Modified Capabilities
- `world-tick`: NPC due-check uses `nextTickInGameDay <= inGameDay` (integer comparison) instead of string comparison.
- `game-engine`: `take_long_rest` increments `inGameDay` in addition to updating the narrative date string.
- `npc-agendas`: `nextTickInGameDay` is now an integer offset; world tick sets it as `currentInGameDay + N`.
- `campaign-setup`: World seed initialises `inGameDay = 1`.

## Impact

- `Campaign` entity — add `inGameDay: integer` with default 1; MikroORM migration required
- `Npc` entity — rename `nextTickInGameDate: string | null` → `nextTickInGameDay: number | null`; MikroORM migration required
- `WorldTickWorker` — `getDueNpcs` query updated; agenda outcome writer sets integer day offset
- `RestService` — `take_long_rest` increments `campaign.inGameDay`
- `CampaignSetupService` — initialise `inGameDay = 1` on world seed persist
- Depends on `world-system`, `game-engine`
