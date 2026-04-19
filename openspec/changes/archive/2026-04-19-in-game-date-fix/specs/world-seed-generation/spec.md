## MODIFIED Requirements

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
