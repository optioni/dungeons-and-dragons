## Context

`Campaign.inGameDate` and `Npc.nextTickInGameDate` are currently narrative strings (e.g. `"Day 14, Month of Frost"`). The world tick worker queries NPCs with `nextTickInGameDate <= now`, which is a string comparison against a narrative date — semantically meaningless and silently wrong. NPCs may fire in the wrong order, fire too early, or never fire. This is a latent correctness bug affecting every world tick.

The fix introduces `inGameDay: integer` as a monotonic day counter — the authoritative source of truth for all time-relative comparisons. Narrative strings are retained for display only.

Affected modules: `WorldModule` (world tick, NPC entity), `CampaignModule` (Campaign entity, setup), `GameEngineModule` (rest service).

## Goals / Non-Goals

**Goals:**
- Replace string-based time comparison with reliable integer comparison throughout the world tick pipeline
- Add `Campaign.inGameDay` (monotonic counter, starts at 1, incremented by `take_long_rest`)
- Replace `Npc.nextTickInGameDate: string | null` with `Npc.nextTickInGameDay: number | null`
- Update `WorldTickWorker.getDueNpcs` to use `nextTickInGameDay <= campaign.inGameDay`
- Update agenda outcome writer to set `nextTickInGameDay` as an integer offset
- Initialise `inGameDay = 1` in `CampaignSetupService`
- Write and run MikroORM migrations for both schema changes

**Non-Goals:**
- Removing the narrative `inGameDate` string — it stays for UI display
- Changing the world tick scheduling mechanism (still BullMQ + `take_long_rest`)
- Altering how `inGameDate` (string) is computed or formatted
- Changing any frontend code (the integer is an internal field; display string is unchanged)

## Decisions

### Integer counter rather than a real-world timestamp

**Decision:** Use a monotonic `inGameDay` integer rather than a `Date` or Unix timestamp.

**Rationale:** In-game time only advances on explicit player actions (`take_long_rest`). There is no real-time wall-clock relationship. An integer is the simplest, most correct representation: it can be compared with `<=`, incremented by 1, and stored as a plain database integer with no timezone or precision concerns. A timestamp would imply a relationship to wall time that does not exist.

**Alternatives considered:**
- *Unix timestamp / Date*: Adds timezone handling complexity with no benefit; in-game days are discrete, not continuous.
- *Ordinal string (e.g. "0014")*: Zero-padded strings compare correctly but are fragile and harder to reason about than integers.

### Keep `inGameDate` string for display

**Decision:** `Campaign.inGameDate` (narrative string) is retained alongside `inGameDay`.

**Rationale:** The DM LLM needs a human-readable calendar for narrative generation (`"Month of Frost, Day 14"`). The integer alone is too bare for prompt context. Keeping both fields avoids coupling the narrative calendar format to the ordering logic.

### `nextTickInGameDay` is nullable

**Decision:** `Npc.nextTickInGameDay: number | null` — `null` means the NPC has no scheduled tick.

**Rationale:** Mirrors the original `nextTickInGameDate: string | null` contract. Null NPCs are simply excluded from `getDueNpcs`. This avoids a sentinel value (e.g. `-1` or `0`) that would require special-casing in queries.

### Migration replaces column rather than renaming

**Decision:** Drop `nextTickInGameDate` and add `nextTickInGameDay` in the same migration.

**Rationale:** The app is in active development with no deployed instances. A clean column replacement is simpler than an additive migration with a backfill. No data migration is needed — existing NPC rows get `nextTickInGameDay = null`, which is correct (no scheduled tick until the next world tick runs).

## Risks / Trade-offs

- **All existing `nextTickInGameDate` values are discarded** → Acceptable: the string values were never correctly comparable anyway. NPCs will simply have no scheduled tick until the next world tick assigns one. The world tick will reschedule them on the next `take_long_rest`.
- **`inGameDay` starts at 1 for new campaigns only** → Existing campaigns have no `inGameDay`. Migration sets a default of `1`; this is a conservative starting value. In-game continuity is unaffected because `inGameDay` only gates NPC agendas, not narrative content.
- **Integer wraps at 2^31 − 1** → At one day per long rest this is ~5.8 million in-game years. Not a practical concern.

## Migration Plan

1. Create MikroORM migration:
   - Add `in_game_day INTEGER NOT NULL DEFAULT 1` to `campaign`
   - Drop `next_tick_in_game_date` from `npc`
   - Add `next_tick_in_game_day INTEGER NULL` to `npc`
2. Update entities (`Campaign`, `Npc`) to reflect new columns
3. Update `WorldTickWorker.getDueNpcs` to query `npc.next_tick_in_game_day <= campaign.in_game_day`
4. Update agenda outcome writer to set `nextTickInGameDay = campaign.inGameDay + N`
5. Update `RestService.take_long_rest` to increment `campaign.inGameDay += 1`
6. Update `CampaignSetupService` to set `inGameDay = 1` on world seed persist
7. Run `yarn mikro-orm migration:up` in the API package

Rollback: drop the two new columns, restore `next_tick_in_game_date TEXT NULL`. No data is recoverable from the dropped column (acceptable per rationale above).

## Open Questions

- Should `inGameDay` be exposed in the `Campaign` GraphQL type? Currently it is an internal ordering field. Exposing it might be useful for the frontend (e.g. displaying "Day 14" derived from the integer), but `inGameDate` string already serves that purpose.
