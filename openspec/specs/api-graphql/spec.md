# Capability: API GraphQL

## Purpose

Defines requirements for the GraphQL API surface — owner-scoped queries, relay connections, and field coverage needed to support frontend pages including campaign info pages.

## Requirements

### Requirement: Campaign character lookup supports info page navigation
The API SHALL provide enough authenticated, owner-scoped GraphQL data for `/campaign/[id]/character` to load the campaign's character without requiring the player to manually know a character id. If an existing campaign or character query already exposes this relationship, the implementation SHALL reuse it; otherwise it SHALL add a narrow owner-scoped query for the campaign character.

#### Scenario: Owner loads character by campaign context
- **WHEN** the campaign owner opens the character sheet route with a campaign id
- **THEN** the frontend can query the owned campaign character and render the sheet

#### Scenario: Non-owner requests campaign character data
- **WHEN** a user requests character data for another user's campaign
- **THEN** the API returns a not-found or forbidden result and does not expose character state

### Requirement: Character info queries expose complete sheet fields
The API SHALL expose the fields needed by the character sheet page, including identity, race, class, level, proficiency bonus, ability scores, HP, max HP, AC, hit dice remaining, conditions, spell slots, prepared spells, skill proficiencies, currency, XP, inventory, and item detail fields. Existing resolvers SHALL be extended rather than duplicating domain ownership.

#### Scenario: Character sheet query executes
- **WHEN** the owner queries the character sheet fields for their campaign character
- **THEN** the response contains all fields required to render the character sheet without additional undocumented REST calls

#### Scenario: Inventory query includes item details
- **WHEN** the owner queries character inventory for the sheet
- **THEN** each item includes equip state, condition, item type, description, weight, value, and available equipment stats

### Requirement: Diary entries are exposed as an owner-scoped relay connection
The API SHALL expose an authenticated `diaryEntries(campaignId: ID!, first: Int, after: String)` GraphQL query returning a relay connection of diary entries. Each diary entry node SHALL expose id, campaign id, entry type, in-game date, content, and created timestamp. The query SHALL NOT expose embedding vectors or internal search metadata.

#### Scenario: Owner queries diary entries
- **WHEN** the campaign owner queries `diaryEntries(campaignId, first: 7)`
- **THEN** the API returns the newest diary entries for that campaign in relay connection shape

#### Scenario: Diary pagination uses cursor
- **WHEN** the first diary query returns `hasNextPage`
- **THEN** the caller can pass `after: endCursor` to retrieve older diary entries

#### Scenario: Non-owner queries diary entries
- **WHEN** a user queries diary entries for another user's campaign
- **THEN** the API returns a not-found or forbidden result and does not expose diary content

### Requirement: World overview list queries support campaign info page needs
The API SHALL expose authenticated, owner-scoped GraphQL data for factions, NPCs, and world events in relay connection shape. World events SHALL be filterable by status so the world overview can request active events without client-side filtering of unrelated statuses.

#### Scenario: Owner queries factions for world overview
- **WHEN** the campaign owner queries `factions(campaignId, first: n)`
- **THEN** the API returns campaign factions with name, goals, power level, player disposition, and territory data needed by the page

#### Scenario: Owner queries NPC roster for world overview
- **WHEN** the campaign owner queries `npcs(campaignId, first: n, after: cursor)`
- **THEN** the API returns NPC roster fields and relay pagination metadata

#### Scenario: Owner queries active world events
- **WHEN** the campaign owner queries `worldEvents(campaignId, status: ACTIVE, first: n)`
- **THEN** the API returns only active world events for that campaign in relay connection shape

### Requirement: NPC profile query supports on-demand details
The API SHALL expose an authenticated, owner-scoped single-NPC query that returns profile details needed by the world overview modal, including description, motivation, speech style, current location, party status, and relationships when available.

#### Scenario: Owner opens NPC profile
- **WHEN** the campaign owner requests a specific NPC by id
- **THEN** the API returns profile details for that NPC if it belongs to the owner's campaign

#### Scenario: Non-owner requests NPC profile
- **WHEN** a user requests an NPC belonging to another user's campaign
- **THEN** the API returns a not-found or forbidden result and does not expose NPC details
