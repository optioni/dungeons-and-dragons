# World Seed Generation

## Purpose

Defines the LLM-driven setup flow that transforms a player's character and chosen campaign tone into a fully playable starting state. The flow covers story concept generation, concept selection, world seed generation, and the transactional persistence strategy that ensures the campaign is either fully ready to play or cleanly recoverable from failure.

## Requirements

### Requirement: Story concepts are generated from character and tone and stored on the campaign
The system SHALL expose a `generateCampaignStoryConcepts` mutation for an authenticated campaign owner. The mutation SHALL accept the chosen campaign tone and death mode, derive context from the campaign's associated character, and generate 3-4 structured story concepts. Each concept SHALL include a premise, a central conflict, and a hint at the antagonist. The generated concepts SHALL be persisted on the campaign in structured JSON so setup can resume without regenerating them.

#### Scenario: Story concepts are generated and stored
- **WHEN** the owner calls `generateCampaignStoryConcepts` for a draft campaign with a valid tone and death mode
- **THEN** the system stores 3-4 generated story concepts on the campaign and updates the setup state to indicate concepts are available

#### Scenario: Generated concepts are tailored to the character
- **WHEN** concepts are generated for a campaign with an associated character
- **THEN** each returned concept reflects that character's class, backstory context, or fantasy role in the premise or conflict

#### Scenario: Non-owner cannot generate concepts
- **WHEN** a user calls `generateCampaignStoryConcepts` for another user's campaign
- **THEN** the system returns a not-found or forbidden result and does not generate concepts

#### Scenario: Campaign without a character cannot generate concepts
- **WHEN** the owner calls `generateCampaignStoryConcepts` for a campaign that does not yet have an associated character
- **THEN** the mutation returns a validation error indicating character creation must be completed first

### Requirement: Story concept selection persists the player's chosen campaign direction
The system SHALL expose a `selectCampaignStoryConcept` mutation for the campaign owner. The mutation SHALL accept one of the currently persisted generated concepts for the campaign and persist it as the selected concept for later world generation.

#### Scenario: Valid generated concept can be selected
- **WHEN** the campaign owner selects one of the currently stored story concepts
- **THEN** the selected concept is persisted on the campaign and becomes the input for world seed generation

#### Scenario: Unknown concept selection is rejected
- **WHEN** the campaign owner submits a concept identifier or index that is not present in the campaign's persisted generated concepts
- **THEN** the mutation returns a validation error and the selected concept remains unchanged

### Requirement: World seed generation persists a complete playable starting state
The system SHALL expose a `generateCampaignWorldSeed` mutation for the campaign owner. Using the selected story concept, the mutation SHALL generate and persist a complete world seed that includes:
- locations, factions, NPCs, and world events
- 1 starting location stored on the campaign
- 1 lore document stored on the campaign
- 1 antagonist pointer stored on the campaign
- 1 opening scene seed stored on the campaign
- `Campaign.inGameDay` initialised to `1`

#### Scenario: Successful world seed creates playable starting state
- **WHEN** `generateCampaignWorldSeed` succeeds for a campaign with a selected concept
- **THEN** the campaign stores a starting location, lore document, opening scene seed, antagonist pointer, the required world rows, and `Campaign.inGameDay = 1`

#### Scenario: World seed sets inGameDay to 1
- **WHEN** the initial world seed is persisted
- **THEN** `Campaign.inGameDay` is set to `1`, establishing the monotonic day counter at the start of the campaign

### Requirement: World seed persistence is transactional and idempotent
World seed persistence SHALL be applied as a single logical operation. If validation or persistence fails, the system SHALL NOT leave a partially seeded world in the database. If the same campaign is submitted again after a successful seed, the system SHALL NOT create duplicate world rows.

#### Scenario: Invalid generated payload does not create partial world data
- **WHEN** the generated world seed fails schema validation before persistence completes
- **THEN** no partial locations, factions, NPCs, or world events are committed for that campaign

#### Scenario: Repeated successful seed request does not duplicate world rows
- **WHEN** `generateCampaignWorldSeed` is called again for a campaign that is already ready to play
- **THEN** the system rejects or no-ops the request without creating duplicate seed data

### Requirement: World seed generation returns structured validation and generation errors
If story concept generation, concept selection, or world seed generation fails, the system SHALL return structured errors that identify the failed step and preserve the campaign's last valid setup state so the user can retry from that point.

#### Scenario: Generation failure preserves resumable state
- **WHEN** world seed generation fails after concepts have been selected but before any world rows are committed
- **THEN** the campaign still retains its tone, death mode, generated concepts, and selected concept so setup can be retried

#### Scenario: Undersized world seed is rejected
- **WHEN** the generated payload contains fewer than 3 locations or lacks a starting-location discovery row, antagonist event, opening scene seed, or lore document
- **THEN** the system returns a structured validation error and does not mark the campaign ready to play
