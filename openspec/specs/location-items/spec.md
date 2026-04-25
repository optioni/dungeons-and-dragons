# location-items Specification

## Purpose
TBD - created by archiving change persistent-npcs-and-sublocations. Update Purpose after archive.
## Requirements
### Requirement: LocationItem entity represents items present at a non-dungeon location
The system SHALL have a `LocationItem` entity with fields: `locationId` (FK → Location), `itemId` (FK → Item), `quantity` (integer, default 1), and `note` (nullable text — a short description of how the item came to be there). `LocationItem` is distinct from the dungeon-only `RoomItem` entity and is used exclusively for overworld locations.

#### Scenario: LocationItem is created when an item is placed at a location
- **WHEN** `place_item` is executed with a valid `location_id` and `item_id`
- **THEN** a `LocationItem` row is persisted linking that location and item with the specified quantity and optional note

#### Scenario: Multiple quantity of the same item stacks in a single LocationItem row
- **WHEN** `place_item` is called for an item that already has a `LocationItem` row at the same location
- **THEN** the existing row's quantity is incremented rather than creating a duplicate row

#### Scenario: LocationItem is removed when the last quantity is taken
- **WHEN** `take_item` reduces a `LocationItem`'s quantity to zero
- **THEN** the `LocationItem` row is deleted

### Requirement: DM can place items at any location via place_item tool
The system SHALL provide a `place_item` tool available to the DM model. It SHALL accept `location_id` (required), `item_id` (required), `quantity` (optional, default 1), and `note` (optional). The item referenced by `item_id` SHALL already exist as a campaign `Item` row. `place_item` SHALL be usable by the DM to model NPC behaviour (an NPC leaves something behind) or environmental storytelling (a package was delivered).

#### Scenario: NPC leaves an item at a location via world-tick agenda
- **WHEN** the world-tick Haiku processes an NPC agenda that involves leaving something behind
- **THEN** the Haiku calls `place_item` with the location the NPC is departing and the item ID, creating a `LocationItem` row

#### Scenario: DM places an item at the current location mid-session
- **WHEN** the DM invokes `place_item` with a valid location and item during a turn
- **THEN** the `LocationItem` row is created and the item appears in the `## Items Here` world block section on the next turn

#### Scenario: place_item with unknown item_id returns structured error
- **WHEN** `place_item` is called with an `item_id` that does not exist in the campaign
- **THEN** the tool returns `{ success: false, errorCode: 'ITEM_NOT_FOUND' }` and no `LocationItem` is created

### Requirement: Player can take items from a location via take_item tool
The system SHALL provide a `take_item` tool available to the DM model. It SHALL accept `location_id` (required), `item_id` (required), and `quantity` (optional, default 1). Executing it SHALL transfer the item from the `LocationItem` row into the active character's inventory via `ItemService.giveItem`, decrement or delete the `LocationItem` row, and run the quest auto-checker.

#### Scenario: Player picks up an item from the current location
- **WHEN** the DM invokes `take_item` with the current location and a valid item_id
- **THEN** the item is added to the character's `CharacterItem` inventory, the `LocationItem` quantity is decremented, and the tool returns success with the item name

#### Scenario: Taking more than available quantity returns structured error
- **WHEN** `take_item` is called with a quantity greater than the `LocationItem.quantity`
- **THEN** the tool returns `{ success: false, errorCode: 'INSUFFICIENT_QUANTITY' }` and no transfer occurs

#### Scenario: take_item triggers quest auto-checker
- **WHEN** `take_item` successfully transfers an item to the character
- **THEN** the quest auto-checker runs and any completed quest objectives are reflected in the tool result

### Requirement: World block shows items present at the current location
The `loadWorldBlock` method SHALL include a `## Items Here` section when one or more `LocationItem` rows exist for the campaign's current location. Each entry SHALL list the item name, quantity, and note (if any). This section SHALL be omitted when no items are present.

#### Scenario: Items at current location appear in the DM world block
- **WHEN** one or more `LocationItem` rows exist for the campaign's `currentLocationId`
- **THEN** the world block includes `## Items Here` with each item's name, quantity, and note

#### Scenario: No items at current location — section is omitted
- **WHEN** no `LocationItem` rows exist for the current location
- **THEN** the `## Items Here` section is omitted from the world block

#### Scenario: DM sees a placed item on the next turn after place_item
- **WHEN** `place_item` is called during turn N
- **THEN** the `## Items Here` section on turn N+1 includes the newly placed item

### Requirement: place_item and take_item are exposed in DM_TOOLS
Both `place_item` and `take_item` SHALL have JSON schema definitions in `DM_TOOLS` alongside the other game-engine tools.

#### Scenario: DM can call place_item and take_item during any scene
- **WHEN** the DM model invokes `place_item` or `take_item` during a non-dungeon scene
- **THEN** the orchestrator dispatches the call through `ToolRegistry` and returns a structured result

