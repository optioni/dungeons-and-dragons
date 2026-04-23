# Dungeon Loot Spec

## Purpose

Defines how treasure pre-placed in dungeon rooms is managed and transferred to the player character — covering the `add_room_item` tool for DM world-building and the `loot_room` tool for player-triggered item acquisition, including partial looting and quest integration.

## Requirements

### Requirement: add_room_item tool pre-places items in dungeon rooms
The system SHALL expose an `add_room_item(roomId, itemId, quantity, containerName?)` LLM tool. It SHALL validate that the room belongs to the active dungeon's campaign and that the item exists. On success it SHALL create a `RoomItem` row. The tool SHALL fail if `activeDungeonId` is null.

#### Scenario: Item is pre-placed in a room
- **WHEN** the DM calls `add_room_item` with a valid room and item id
- **THEN** a `RoomItem` row is persisted with the specified quantity and optional container name

#### Scenario: Item from another campaign is rejected
- **WHEN** the DM calls `add_room_item` with an item id not belonging to the session's campaign (and not an SRD item)
- **THEN** the tool returns `errorCode: ITEM_NOT_FOUND`

#### Scenario: Multiple items can be placed in the same room
- **WHEN** the DM calls `add_room_item` twice for the same room with different item ids
- **THEN** two distinct `RoomItem` rows are persisted for that room

### Requirement: loot_room tool transfers room items to the character
The system SHALL expose a `loot_room(roomId, itemId, quantity)` LLM tool. It SHALL find the matching `RoomItem`, call `ItemService.giveItem` to transfer `quantity` units to the character, and remove the `RoomItem` row (or decrement quantity if partial). It SHALL emit a `STATE_CHANGED_EVENT` of type `GIVE_ITEM` so the quest auto-checker fires. The tool SHALL fail if no matching `RoomItem` exists for the given room and item.

#### Scenario: Looting a room item transfers it to the character inventory
- **WHEN** the DM calls `loot_room` with a valid room id and item id
- **THEN** a `CharacterItem` row is created (or quantity incremented) for the character and the `RoomItem` is removed

#### Scenario: Partial loot decrements room item quantity
- **WHEN** the DM calls `loot_room` with a quantity less than the `RoomItem.quantity`
- **THEN** the `RoomItem.quantity` is decremented by the requested amount and the item is not removed

#### Scenario: Looting the full quantity removes the RoomItem row
- **WHEN** the DM calls `loot_room` with a quantity equal to `RoomItem.quantity`
- **THEN** the `RoomItem` row is deleted from the database

#### Scenario: Looting a non-existent room item returns error
- **WHEN** the DM calls `loot_room` for a room and item combination with no matching `RoomItem`
- **THEN** the tool returns `errorCode: ITEM_NOT_IN_ROOM`

#### Scenario: Quest auto-checker fires after looting
- **WHEN** `loot_room` succeeds
- **THEN** a `StateChangedEvent` of type `GIVE_ITEM` is emitted so quest objectives of type `HAVE_ITEM` are evaluated

### Requirement: Room items are queryable by room
The system SHALL expose a GraphQL query for `RoomItem` rows by `roomId`, returning item id, quantity, and container name. The query SHALL be scoped to the authenticated campaign owner.

#### Scenario: Room items for a given room are returned
- **WHEN** the owner queries items for a specific room id
- **THEN** all `RoomItem` rows for that room are returned with their item details and container names
