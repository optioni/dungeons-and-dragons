## MODIFIED Requirements

### Requirement: Long rest fully restores HP, spell slots, and hit dice
The system SHALL expose a `take_long_rest` tool that accepts `characterId`. The tool SHALL restore `Character.hp` to `Character.maxHp`, restore all `Character.spellSlots` entries to their `total` value, restore all expended hit dice (up to half the character's level, rounded up, per D&D 5e rules), reset death save counters to 0, increment `Campaign.inGameDay` by 1, and update `Campaign.inGameDate` (narrative string) by 1 day. After applying all character and campaign changes, the tool SHALL asynchronously trigger `MemoryModule.writeDiaryEntry(campaignId)` and enqueue a world tick BullMQ job via `QueueModule`. These side effects SHALL be fire-and-forget — the tool SHALL return success before they complete.

#### Scenario: Long rest restores full HP and spell slots
- **WHEN** the LLM calls `take_long_rest` for a character with 8 HP (maxHp 20) and 2 used spell slots at level 1
- **THEN** `Character.hp` is set to 20 and all `spellSlots[*].used` are reset to 0

#### Scenario: Long rest advances the in-game day counter
- **WHEN** `take_long_rest` completes character restoration
- **THEN** `Campaign.inGameDay` increments by 1

#### Scenario: Long rest also updates the narrative date string
- **WHEN** `take_long_rest` completes character restoration
- **THEN** `Campaign.inGameDate` (narrative string) is advanced by 1 day alongside `Campaign.inGameDay`

#### Scenario: Long rest triggers diary write and world tick asynchronously
- **WHEN** `take_long_rest` completes
- **THEN** a diary entry write is initiated and a world tick job is enqueued without blocking the tool response

#### Scenario: Long rest restores hit dice up to half character level
- **WHEN** a level 4 character has spent all 4 hit dice
- **THEN** `take_long_rest` restores 2 hit dice (half of 4, rounded up) to `Character.hitDiceRemaining`

#### Scenario: Long rest resets death save counters
- **WHEN** `take_long_rest` is called on a character who had death save counters > 0
- **THEN** both `deathSaveSuccesses` and `deathSaveFailures` are reset to 0
