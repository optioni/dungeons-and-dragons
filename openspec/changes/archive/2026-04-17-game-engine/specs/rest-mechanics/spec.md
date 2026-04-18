## ADDED Requirements

### Requirement: Short rest restores partial HP via hit dice
The system SHALL expose a `take_short_rest` tool that accepts `characterId` and an optional `hitDiceToSpend` integer. The tool SHALL allow the character to spend up to `hitDiceToSpend` hit dice (capped at remaining hit dice). Each hit die roll SHALL add the character's CON modifier (minimum 1 HP per die). The tool SHALL restore the resulting HP (up to `maxHp`) and decrement `Character.hitDiceRemaining`. A short rest SHALL NOT advance `inGameDate`, SHALL NOT trigger the world tick, and SHALL NOT write a diary entry.

#### Scenario: Spending hit dice restores HP
- **WHEN** the LLM calls `take_short_rest` with `hitDiceToSpend: 2` for a Fighter with d10 hit dice and CON modifier +2
- **THEN** the tool rolls 2d10, adds 4 (2×CON modifier), restores that HP up to maxHp, and decrements `Character.hitDiceRemaining` by 2

#### Scenario: Cannot spend more hit dice than remaining
- **WHEN** the LLM calls `take_short_rest` with `hitDiceToSpend` exceeding `Character.hitDiceRemaining`
- **THEN** the tool caps spending at the remaining count and returns `{ hitDiceSpent: <remaining> }`

#### Scenario: Short rest does not advance the in-game date
- **WHEN** `take_short_rest` completes successfully
- **THEN** `Campaign.inGameDate` is unchanged

#### Scenario: Zero hit dice requested is valid
- **WHEN** the LLM calls `take_short_rest` with `hitDiceToSpend: 0`
- **THEN** the tool succeeds, no HP is restored, and no hit dice are spent

### Requirement: Long rest fully restores HP, spell slots, and hit dice
The system SHALL expose a `take_long_rest` tool that accepts `characterId`. The tool SHALL restore `Character.hp` to `Character.maxHp`, restore all `Character.spellSlots` entries to their `total` value, restore all expended hit dice (up to half the character's level, rounded up, per D&D 5e rules), reset death save counters to 0, and increment `Campaign.inGameDate` by 1. After applying all character changes, the tool SHALL asynchronously trigger `MemoryModule.writeDiaryEntry(campaignId)` and enqueue a world tick BullMQ job via `QueueModule`. These side effects SHALL be fire-and-forget — the tool SHALL return success before they complete.

#### Scenario: Long rest restores full HP and spell slots
- **WHEN** the LLM calls `take_long_rest` for a character with 8 HP (maxHp 20) and 2 used spell slots at level 1
- **THEN** `Character.hp` is set to 20 and all `spellSlots[*].used` are reset to 0

#### Scenario: Long rest advances the in-game date
- **WHEN** `take_long_rest` completes character restoration
- **THEN** `Campaign.inGameDate` increments by 1

#### Scenario: Long rest triggers diary write and world tick asynchronously
- **WHEN** `take_long_rest` completes
- **THEN** a diary entry write is initiated and a world tick job is enqueued without blocking the tool response

#### Scenario: Long rest restores hit dice up to half character level
- **WHEN** a level 4 character has spent all 4 hit dice
- **THEN** `take_long_rest` restores 2 hit dice (half of 4, rounded up) to `Character.hitDiceRemaining`

#### Scenario: Long rest resets death save counters
- **WHEN** `take_long_rest` is called on a character who had death save counters > 0
- **THEN** both `deathSaveSuccesses` and `deathSaveFailures` are reset to 0
