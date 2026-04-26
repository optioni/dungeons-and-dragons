## ADDED Requirements

### Requirement: Ready Campaign Navigation Is Covered

The project SHALL have automated web coverage proving that a ready campaign can be entered from normal navigation.

#### Scenario: Dashboard Play opens the play route

- **GIVEN** the campaign list contains a campaign with `setupStatus` `READY_TO_PLAY`
- **WHEN** the player activates the campaign Play control
- **THEN** the app navigates to `/campaign/:id/play`

#### Scenario: Completed setup opens the play route

- **GIVEN** a campaign setup route loads a campaign with `setupStatus` `READY_TO_PLAY`
- **WHEN** the completion action is activated
- **THEN** the app navigates to `/campaign/:id/play`

### Requirement: Inspectable State Pages Are Covered

The project SHALL have web tests for campaign state pages that a player uses after play.

#### Scenario: Character sheet renders loaded character state

- **GIVEN** character sheet GraphQL queries return a character and inventory
- **WHEN** the character sheet route renders
- **THEN** key identity, hit point, ability, spell, and inventory state are visible

#### Scenario: Quest page renders active and finished quests

- **GIVEN** quest queries return active and completed quest data
- **WHEN** the quests route renders
- **THEN** active objectives and finished quest rewards are visible

#### Scenario: World diary load-more uses the cursor

- **GIVEN** diary entries return `hasNextPage` and an `endCursor`
- **WHEN** the player loads older diary entries
- **THEN** the next query uses the cursor and appends the older entries

### Requirement: Core Play Smoke Verification Exists

The project SHALL provide a deterministic way to verify the core play loop without requiring a live LLM call in routine tests.

#### Scenario: Smoke path exercises player input and stream completion

- **GIVEN** a campaign and character are ready for play
- **AND** the LLM transport is fake or otherwise deterministic
- **WHEN** the player submits input from the play route
- **THEN** the smoke check verifies session start or resume, accepted player input, streamed completion, and inspectable state after the turn

#### Scenario: Live LLM smoke is opt-in

- **GIVEN** a smoke check would use a real Anthropic API key
- **WHEN** normal test commands run
- **THEN** the live check is skipped unless explicitly requested by the operator
