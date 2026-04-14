## Context

The `Character` entity is the mechanical core of every campaign session. Before the game engine can resolve any action — attack roll, skill check, spell, rest — it needs authoritative character state. This design covers the `CharacterModule` (API) and the two web pages that expose it to the player.

Existing foundations this design builds on:
- `SrdClass` and `SrdRace` entities are already seeded and queryable (read-only)
- `SrdEquipment` is seeded and available for item linking
- Auth infrastructure (`User`, JWT guard, `@CurrentUser`) is in place
- Shared GraphQL relay pagination and `WhereService` helpers exist in `apps/api/src/graphql/`

The character system is a prerequisite for `CampaignModule`, `SessionModule`, and `GameEngineModule`.

## Goals / Non-Goals

**Goals:**
- Define the `Character` entity with all mechanical state required by the game engine
- Define `Item` and `CharacterItem` entities for inventory management
- Expose GraphQL queries for the character sheet and inventory
- Expose GraphQL mutations for character creation and item equipping
- Implement the character creation wizard page and character sheet page in web

**Non-Goals:**
- Leveling mechanics (handled later by game engine on XP thresholds)
- Combat resolution — AC, HP, and conditions are stored here; modification is the game engine's job
- Crafting or item generation — items are created by game engine tool calls, not the player directly
- Party or multiplayer character management

## Decisions

### 1. Race and Class as SRD references (ManyToOne)

`Character.race` → `SrdRace`, `Character.class` → `SrdClass`.

Rationale: SRD data is already seeded and queryable. Storing index strings would duplicate lookup logic and break GraphQL type safety. ManyToOne gives lazy-loaded access to hit die, saving throw proficiencies, and spellcasting ability without embedding those values on Character.

Alternative considered: Store race/class as plain string index and re-fetch SRD data on demand. Rejected — this leaks SRD joins into every consumer.

### 2. Ability scores stored as JSONB

`abilityScores: { STR, DEX, CON, INT, WIS, CHA }` stored as a single `jsonb` column.

Rationale: The six scores always travel together, are never queried individually at the database level, and the shape is stable and well-known. Six separate integer columns would add schema noise without any query benefit.

Scores are base values set at character creation. Modifiers (`Math.floor((score - 10) / 2)`) are computed in TypeScript, not stored.

### 3. Proficiency bonus is a computed GraphQL field

`proficiencyBonus` is derived from level (floor((level - 1) / 4) + 2). It is not stored in the database.

Rationale: It is a pure function of level with no exceptions. Storing it introduces a sync obligation whenever level changes. The resolver computes and returns it inline.

### 4. AC is stored, not computed

`ac: integer` is stored on Character and updated by the game engine tool call `update_character_state`.

Rationale: AC depends on equipped armor, race traits (natural armor), spell effects, and class features — a full computation requires real-time inventory and spell state. The game engine already holds that context during tool resolution. Storing the current AC keeps the character sheet query simple and the game engine authoritative.

### 5. Spell slots stored as JSONB array

`spellSlots: Array<{ level: number; total: number; used: number }>` stored as `jsonb`.

Rationale: The structure varies by class and level (non-casters have no entries; full casters have up to 9 levels). JSONB avoids a separate SpellSlot table and keeps the entity self-contained. The game engine reads and writes this atomically per rest/spell-cast tool call.

Empty array for non-spellcasting classes.

### 6. Items reference SrdEquipment optionally

`Item.srdEquipment` → `SrdEquipment | null`.

Rationale: The game engine can grant narrative items (a cursed ring, a plot artifact) that have no SRD equivalent. Making the SRD link nullable supports both cases without a separate entity hierarchy.

An `Item` row is created by the game engine on `grant_item` tool calls; the player never creates items directly.

### 7. Equipped slots as an enum column on CharacterItem

`CharacterItem.slot: EquipSlot | null` — `null` means carried but not equipped.

Slots: `MAIN_HAND`, `OFF_HAND`, `HEAD`, `CHEST`, `HANDS`, `FEET`, `RING_1`, `RING_2`, `NECK`, `BACK`.

Rationale: A fixed slot enum prevents duplicate equipping (two helmets) and maps cleanly to the character sheet UI. The game engine enforces slot uniqueness via the `equip_item` tool call — the API validates that no other CharacterItem for this character occupies the requested slot.

### 8. Character creation uses a standard array, not rolled stats

The creation wizard presents the standard array `[15, 14, 13, 12, 10, 8]` for ability score assignment. The player assigns each value to a score.

Rationale: Rolled stats require random seed management across a multi-step wizard (refresh = reroll, leading to abuse). Point buy adds significant UI complexity. The standard array is the most common beginner-friendly method and keeps the wizard stateless.

The `createCharacter` mutation accepts the six final score values; the API validates that they exactly match a permutation of the standard array.

### 9. Character belongs to a Campaign (ManyToOne), not to a User directly

`Character.campaign` → `Campaign`.

Rationale: The design spec models character as campaign-scoped (a campaign has one character). Users reach their character through their campaign. This avoids a Character → User → Campaign join and keeps the ownership chain clear.

`Campaign` will have a `OneToOne` back-reference to `Character` (added when CampaignModule is implemented).

### 10. Skill proficiencies stored as JSONB map

`skillProficiencies: Record<SkillName, 'none' | 'proficient' | 'expert'>` stored as `jsonb`.

Rationale: 18 skills, each with a three-state value. A join table would be more normalized but adds a migration and resolver complexity for a fixed-schema structure that the game engine writes atomically.

## Risks / Trade-offs

**JSONB mutation correctness** — `spellSlots`, `abilityScores`, and `skillProficiencies` are written as whole objects. A partial update (e.g., decrement one spell slot) requires the game engine to read, modify, and write the entire JSONB value. No in-place SQL patching.
→ Mitigation: Game engine tool calls always receive the full current state (from LLM context) and return the full new state. Read-before-write is implicit in the LLM tool call flow.

**Standard array validation** — The `createCharacter` mutation must reject stat arrays that are not a permutation of `[15, 14, 13, 12, 10, 8]`. A bug here allows stat cheating.
→ Mitigation: Covered by a unit test on the CharacterService validation method before mutation is wired up.

**Equipped slot race condition** — Two concurrent equip mutations could both see slot as empty and both succeed, resulting in two items in the same slot.
→ Mitigation: The `equip_item` mutation runs inside a MikroORM transaction. A unique index on `(characterId, slot)` (excluding null) enforces slot uniqueness at the database level.

**AC staleness** — If the game engine crashes after granting armor but before calling `update_character_state`, stored AC may be stale.
→ Mitigation: Acceptable for current scope (no deployed prod, single-player). The LLM can recalculate and update AC at session start as a recovery step.

## Migration Plan

1. Add migration for `character`, `item`, `character_item` tables
2. Add unique partial index on `character_item(character_id, slot)` where `slot IS NOT NULL`
3. No seeding required — characters are created by players at runtime
4. No data migration — new tables only

## Open Questions

- **CampaignModule dependency**: `Character.campaign` references `Campaign`, but `CampaignModule` is not yet implemented. The migration can use a raw FK to a `campaign` table that doesn't exist yet, or `Campaign` can be stubbed as a placeholder entity. Decision needed before running migrations.
- **Conditions format**: Should `conditions` store condition names as strings (e.g., `["Poisoned", "Prone"]`) or as references to `SrdCondition`? Strings are simpler; SrdCondition references enable richer UI. Current plan: string array, revisit when UI needs condition descriptions.
