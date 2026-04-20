# Permadeath Auto-End Spec

## Purpose

Defines the automatic campaign-ending behavior triggered when a character death occurs in PERMADEATH mode. The system SHALL write a memorial diary entry and close the campaign without requiring explicit LLM tool invocation.

## Requirements

### Requirement: PERMADEATH death triggers automatic campaign end
The system SHALL check `campaign.deathMode` after `roll_death_save` results in three failed saves or after `instant_death` sets `character.isDead = true`. If `deathMode === PERMADEATH`, the game engine SHALL automatically initiate the permadeath end sequence without requiring the LLM to call `end_campaign`.

#### Scenario: Three failed death saves in PERMADEATH mode ends the campaign
- **WHEN** `roll_death_save` records the third failed save for a character and `campaign.deathMode === PERMADEATH`
- **THEN** the permadeath end sequence is initiated automatically

#### Scenario: Instant death in PERMADEATH mode ends the campaign
- **WHEN** `instant_death` sets `character.isDead = true` and `campaign.deathMode === PERMADEATH`
- **THEN** the permadeath end sequence is initiated automatically

#### Scenario: Death in STORY mode does NOT auto-end the campaign
- **WHEN** `roll_death_save` or `instant_death` fires and `campaign.deathMode === STORY`
- **THEN** no permadeath end sequence is initiated and the campaign remains ACTIVE

### Requirement: Permadeath end sequence writes a memorial diary entry then closes the campaign
The permadeath end sequence SHALL call `DiaryService.writeDiaryEntry` (via Haiku) for a `MEMORIAL` entry type before closing the campaign. The memorial entry SHALL be written from the campaign's session transcript, summarising the character's life and death. After the memorial is persisted, the system SHALL set `campaign.status = ENDED`, end the active session, and emit a `CAMPAIGN_ENDED` STATUS chunk with an auto-generated epitaph.

#### Scenario: Memorial diary entry is created on permadeath
- **WHEN** the permadeath end sequence runs
- **THEN** a `DiaryEntry` with `entryType = MEMORIAL` is persisted for the campaign before the campaign status is changed

#### Scenario: Campaign is ENDED after memorial write succeeds
- **WHEN** the memorial diary entry is successfully written
- **THEN** `campaign.status` is set to `ENDED` with `endedAt` stamped and `endReason` set to a permadeath description

#### Scenario: Memorial write failure does not block campaign end
- **WHEN** the Haiku memorial write call fails
- **THEN** the system logs the error and continues to end the campaign, emitting `CAMPAIGN_ENDED` without a memorial diary entry

#### Scenario: CAMPAIGN_ENDED chunk is emitted after permadeath sequence
- **WHEN** the permadeath end sequence completes (with or without memorial)
- **THEN** a `CAMPAIGN_ENDED` STATUS chunk is emitted with the character's name and death summary as the epitaph, plus `daysPlayed` and `questsCompleted` stats

### Requirement: Permadeath end sequence respects the campaign lock
If the Redis `campaignLocked` lock is held by the world tick when permadeath fires, the system SHALL complete the death tool resolution and return the result to the LLM, then execute the permadeath end sequence once the lock is released.

#### Scenario: World tick in progress does not block death tool result
- **WHEN** `roll_death_save` or `instant_death` fires while `campaignLocked` is held
- **THEN** the tool result is returned immediately and the end sequence is deferred until the lock is free
