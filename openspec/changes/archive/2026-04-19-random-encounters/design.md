## Context

`TravelService.travel_to` currently validates discovery and moves the player but never rolls for danger. The proposal specifies a post-move encounter roll gated on `Location.currentState`, a CR-filtered `SrdMonster` draw, materialisation of temporary `Npc` entities, and a `Campaign.travelEncounterEnabled` safety flag. This design covers the implementation approach for all four new capabilities plus the modifications to `travel_to` and `update_campaign_settings`.

## Goals / Non-Goals

**Goals:**
- Add encounter roll (d20 + danger modifier) immediately after the player moves, before returning the tool result.
- Draw 1-3 `SrdMonster` rows from the database filtered to a CR bracket derived from character level.
- Materialise monsters as unsaved, in-memory `Npc` entities and route through the existing `start_combat` handler.
- Expose `travelEncounterEnabled` on `Campaign` and let the LLM toggle it via `update_campaign_settings`.
- Keep all encounter logic inside `TravelService` / `GameEngineModule`; no changes to `WorldModule`.

**Non-Goals:**
- Persistent random-encounter `Npc` rows or history (temporary entities only, destroyed when combat ends).
- Encounter rolls for rest actions.
- Biome-specific encounter tables or faction-weighted draws (future work).
- Frontend changes — encounter narrative comes back as part of the `travel_to` tool result.

## Decisions

### D1 — Encounter roll inside `TravelService`, not the LLM
The roll happens server-side before the tool result is returned. The LLM only narrates the outcome. This ensures deterministic game state (the encounter is committed before the LLM response), prevents the LLM from cherry-picking results, and keeps parity with how dice rolls already work in `RollService`.

**Alternative considered:** Return a "pending encounter" flag and let the LLM decide whether to trigger combat. Rejected — gives the LLM agency over mechanics that belong to the rules engine.

### D2 — Danger modifier from `Location.currentState` enum
Modifier table: `SAFE=0, TENSE=+2, THREATENED=+4, HOSTILE=+6, RUINED=+3`. This is the only location-state data available at travel time without additional queries.

**Alternative considered:** A numeric `dangerRating` column on `Location`. Rejected as YAGNI — the state enum already encodes danger semantically and requires no migration.

### D3 — CR bracket: `floor(characterLevel / 2) ± 1`, clamped to [0, 30]
This gives a smooth CR progression without replicating the full 5e XP budget system. Simple enough to reason about; not so restrictive that it breaks at low/high levels.

**Alternative considered:** Full XP budget calculation using the DMG encounter-difficulty tables. Rejected — overkill for a solo game; the simpler formula is good enough and avoids hardcoding the XP table.

### D4 — Temporary `Npc` entities are in-memory (not persisted)
`TravelService` constructs `Npc` objects with `EntityManager.create()` but never calls `em.persist()`. `start_combat` receives them by reference; they live for the duration of the combat turn. When `end_combat` resolves, the entities go out of scope. No migration, no cleanup job.

**Alternative considered:** Persist them with a `temporary: boolean` flag and clean up in a post-combat hook. Rejected — adds table noise and a cleanup failure mode for no benefit.

### D5 — Monster draw is a single raw SQL / ORM random query, not in-memory shuffle
`SrdMonster` is large (300+ rows). Loading all CR-matching rows to shuffle in application code is wasteful. A single `ORDER BY RANDOM() LIMIT 3` query is simpler and sufficient for non-critical randomness.

### D6 — `update_campaign_settings` as a new general-purpose settings tool
Rather than a one-off `toggle_travel_encounters` tool, `update_campaign_settings` accepts a partial settings object (`{ travelEncounterEnabled?: boolean }`). This is extensible for future campaign-level flags without adding tool proliferation.

## Risks / Trade-offs

- **Encounter during a cutscene** → Mitigation: `travelEncounterEnabled` flag lets the LLM suppress encounters during story-critical travel. The LLM should set this before narrating a "safe path" milestone.
- **CR bracket produces no monsters** → Mitigation: If the filtered query returns 0 rows, the encounter is silently skipped (no combat started). Tool result notes "no monsters in the area" so the LLM can narrate a false alarm.
- **`start_combat` called from two call sites** → `CombatService.startCombat` is already a plain method call; a second caller is low risk. The method signature is unchanged.
- **`RANDOM()` is non-deterministic** → Test coverage for the draw query can only assert count/CR constraints, not specific monsters. Unit tests for the encounter roll should inject a mock `RollService`.

## Migration Plan

1. Add `travelEncounterEnabled boolean NOT NULL DEFAULT true` column to `campaign` table via a new MikroORM migration.
2. Update `Campaign` entity class.
3. Implement `TravelService` encounter roll + draw logic.
4. Register `update_campaign_settings` tool in `GameEngineToolRegistrarService`.
5. No deployment coordination needed — active development, no live data.

Rollback: revert migration, revert entity and service changes.

## Open Questions

- Should the number of monsters drawn (1-3) be uniform random, or skewed (e.g. weighted toward 1)? Proposal says "1-3 monsters" without specifying distribution — defaulting to uniform `LIMIT floor(random()*3)+1` unless the user clarifies.
- Should `update_campaign_settings` also cover future flags like `fogOfWar` or `permadeath`? Keeping the tool name generic suggests yes — but the initial implementation only exposes `travelEncounterEnabled`.
