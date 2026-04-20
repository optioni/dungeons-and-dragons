## MODIFIED Requirements

### Requirement: Death saves track progress toward stabilisation or death
The system SHALL expose a `roll_death_save` tool that accepts `characterId`. It SHALL roll 1d20: a natural 20 restores the character to 1 HP immediately; a 10 or higher increments `deathSaveSuccesses`; below 10 increments `deathSaveFailures`; a natural 1 increments `deathSaveFailures` by 2. Three successes result in stabilisation; three failures result in death (`Character.isDead = true`). After setting `isDead = true`, the tool handler SHALL check `campaign.deathMode`; if `PERMADEATH`, it SHALL initiate the permadeath end sequence (memorial diary write + campaign closure + `CAMPAIGN_ENDED` chunk).

#### Scenario: Three successes stabilise the character
- **WHEN** `roll_death_save` is called and the character accumulates 3 successes
- **THEN** the tool sets `Character.hp = 1`, resets both counters, and returns `{ outcome: "STABILISED" }`

#### Scenario: Three failures kill the character in STORY mode
- **WHEN** `roll_death_save` is called and the character accumulates 3 failures and `campaign.deathMode === STORY`
- **THEN** the tool sets `Character.isDead = true` and returns `{ outcome: "DEAD" }` without ending the campaign

#### Scenario: Three failures in PERMADEATH mode triggers campaign end
- **WHEN** `roll_death_save` is called and the character accumulates 3 failures and `campaign.deathMode === PERMADEATH`
- **THEN** the tool sets `Character.isDead = true`, initiates the permadeath end sequence, and returns `{ outcome: "DEAD", campaignEnded: true }`

#### Scenario: Natural 20 immediately revives the character
- **WHEN** the death save roll is a natural 20
- **THEN** `Character.hp` is set to 1, both counters reset, and the tool returns `{ outcome: "STABILISED", natural20: true }`

#### Scenario: Natural 1 counts as two failures
- **WHEN** the death save roll is a natural 1
- **THEN** `deathSaveFailures` increments by 2

### Requirement: Instant death and manual stabilisation bypass the death save loop
The system SHALL expose `instant_death` and `stabilise` tools. `instant_death` accepts `characterId` and sets `Character.isDead = true` and `Character.hp = 0` without requiring accumulated failures — used for massive damage or narrative death. After setting `isDead = true`, the tool handler SHALL check `campaign.deathMode`; if `PERMADEATH`, it SHALL initiate the permadeath end sequence. `stabilise` accepts `characterId`, sets `Character.hp = 1`, and resets both death save counters — used when an NPC provides aid mid-combat.

#### Scenario: Instant death bypasses death saves in STORY mode
- **WHEN** the LLM calls `instant_death` on a downed character and `campaign.deathMode === STORY`
- **THEN** `Character.isDead` is set to `true` without checking death save counters and the campaign remains ACTIVE

#### Scenario: Instant death in PERMADEATH mode triggers campaign end
- **WHEN** the LLM calls `instant_death` on a downed character and `campaign.deathMode === PERMADEATH`
- **THEN** `Character.isDead` is set to `true` and the permadeath end sequence is initiated

#### Scenario: Stabilise revives a downed character
- **WHEN** the LLM calls `stabilise` on a character at 0 HP
- **THEN** `Character.hp` is set to 1 and both death save counters reset to 0
