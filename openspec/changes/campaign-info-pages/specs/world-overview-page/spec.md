## ADDED Requirements

### Requirement: Campaign world overview route displays world state
The system SHALL provide an authenticated `/campaign/[id]/world` page that displays campaign world reference information outside the live game session stream. The page SHALL include factions, known NPCs, diary entries, and active world events.

#### Scenario: Owner opens the world overview
- **WHEN** the campaign owner opens `/campaign/[id]/world`
- **THEN** the page displays world overview panels for the campaign without starting or requiring a game session stream

#### Scenario: Non-owner attempts to load world overview data
- **WHEN** a user attempts to load world overview data for another user's campaign
- **THEN** the API rejects the underlying data requests and the page does not expose that campaign's world state

### Requirement: World overview displays factions
The world overview page SHALL display campaign factions with name, goals, player disposition, power level, and territory location names when available. Player disposition SHALL be represented with a visually distinct badge.

#### Scenario: Campaign has factions
- **WHEN** the campaign has faction records
- **THEN** the world overview lists each faction with goals, disposition, power level, and known territory information

#### Scenario: Faction list is empty
- **WHEN** the campaign has no faction records
- **THEN** the faction panel displays an empty state instead of failing

### Requirement: World overview displays known NPC roster
The world overview page SHALL display a paginated roster of campaign NPCs known to the player according to the current world data model. Each roster row SHALL include name, profession, disposition, current location name when available, and party status.

#### Scenario: NPC roster has results
- **WHEN** the campaign has NPC records visible to the player
- **THEN** the page displays those NPCs in a paginated roster

#### Scenario: NPC roster has additional pages
- **WHEN** the NPC connection returns `hasNextPage`
- **THEN** the page offers a way to load the next NPC page using the returned cursor

### Requirement: NPC profile modal displays details on demand
The world overview page SHALL open an NPC profile view when the player selects an NPC. The profile view SHALL display description, motivation, speech style, current location, party status, and relationships available from the API.

#### Scenario: Player selects an NPC
- **WHEN** the player clicks an NPC in the roster
- **THEN** the page loads that NPC's profile data and displays it without navigating away from the world overview

#### Scenario: NPC has relationships
- **WHEN** the selected NPC has relationship records
- **THEN** the profile view lists those relationships with relationship type and related NPC identity when available

### Requirement: World overview displays diary entries
The world overview page SHALL display diary entries in reverse chronological order. The most recent seven entries SHALL be prominent, and older entries SHALL be accessible through pagination or a collapsed older section.

#### Scenario: Recent diary entries exist
- **WHEN** the campaign has diary entries
- **THEN** the page displays each entry's `inGameDate`, entry type, and content with the newest entries first

#### Scenario: Older diary entries are available
- **WHEN** more than seven diary entries exist
- **THEN** the player can access older entries without losing the recent seven-entry overview

### Requirement: World overview displays active world events
The world overview page SHALL display active world events with status, description, source when available, related location when available, and deadline information. The page SHALL display days remaining when the current campaign date and event deadline can be compared.

#### Scenario: Active world events exist
- **WHEN** the campaign has active world events
- **THEN** the page displays each active event with status, description, and deadline context

#### Scenario: No active world events exist
- **WHEN** the campaign has no active world events
- **THEN** the active world events panel displays an empty state instead of showing resolved or expired events as active

### Requirement: World overview is read-only
The world overview page SHALL NOT expose mutations that alter factions, NPCs, diary entries, world events, locations, campaign date, or game session state. All state-changing gameplay actions SHALL remain in the game session and game engine flows.

#### Scenario: Player views world data
- **WHEN** the player interacts with faction, NPC, diary, or world event panels
- **THEN** those interactions only navigate, expand, paginate, or open details and do not mutate campaign state
