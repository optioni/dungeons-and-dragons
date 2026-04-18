# Item Mechanics Spec

## Purpose

Defines how items are created, transferred, equipped, bought, sold, and restocked — all driven by LLM tool calls with no direct player item-management mutations.

## Requirements

### Requirement: Items are created by the game engine on LLM instruction
The system SHALL expose a `create_item` tool that accepts `campaignId` and item fields (name, type, description, damageDice, damageType, acBonus, properties, weight, goldValue, and an optional `srdEquipmentId` and `mapId`). The tool SHALL persist a new `Item` entity and return the created item's id. Items SHALL only be created by LLM tool call — the player has no direct item creation mutation.

#### Scenario: Custom magic item is created with no SRD link
- **WHEN** the LLM calls `create_item` with a name, type MAGIC, description, and properties JSON
- **THEN** a new `Item` row is persisted with `srdEquipmentId = null` and the id is returned

#### Scenario: Item linked to a map auto-discovers locations when obtained
- **WHEN** `create_item` is called with a non-null `mapId`
- **THEN** the item is persisted with the mapId set, and when later given to the character via `give_item`, the system SHALL auto-create `LocationDiscovery` records for all locations on that map

### Requirement: Items are transferred between entities via give_item
The system SHALL expose a `give_item` tool that accepts `itemId`, `quantity`, and one of `toCharacterId` or `toNpcId`. It SHALL create or increment a `CharacterItem` or `NpcItem` record for the recipient. If the item has a `mapId` and the recipient is the player character, the tool SHALL auto-create `LocationDiscovery` records for all `MapLocation` entries linked to that map. The tool SHALL emit a `StateChangedEvent` with `type: 'GIVE_ITEM'` after completing.

#### Scenario: Giving an item to a character creates a CharacterItem
- **WHEN** the LLM calls `give_item` with a valid `itemId` and `toCharacterId`
- **THEN** a `CharacterItem` row is created (or its quantity incremented) for that character

#### Scenario: Receiving a map item discovers its locations
- **WHEN** the LLM calls `give_item` with an item whose `mapId` is set, targeting the player character
- **THEN** `LocationDiscovery` records are created for all locations on that map that are not already discovered

#### Scenario: Giving to NPC creates NpcItem
- **WHEN** the LLM calls `give_item` with `toNpcId`
- **THEN** a `NpcItem` row is created or incremented for that NPC

### Requirement: Items are equipped and unequipped by slot
The system SHALL expose `equip_item` and `unequip_item` tools. `equip_item` accepts `characterItemId` and `slot` (MAIN_HAND, OFF_HAND, ARMOR, ACCESSORY). It SHALL set `CharacterItem.equippedSlot = slot` if no other `CharacterItem` for that character occupies the same slot. If the slot is occupied, the tool SHALL return `{ success: false, reason: "SLOT_OCCUPIED" }`. `unequip_item` accepts `characterItemId` and sets `equippedSlot = null`.

#### Scenario: Equipping an item in a free slot succeeds
- **WHEN** the LLM calls `equip_item` for a character with no item in MAIN_HAND
- **THEN** `CharacterItem.equippedSlot` is set to `MAIN_HAND`

#### Scenario: Equipping to an occupied slot returns structured error
- **WHEN** the LLM calls `equip_item` with slot ARMOR and that character already has an item equipped in ARMOR
- **THEN** the tool returns `{ success: false, reason: "SLOT_OCCUPIED" }` without modifying any row

#### Scenario: Unequipping an item clears its slot
- **WHEN** the LLM calls `unequip_item` for an equipped `CharacterItem`
- **THEN** `CharacterItem.equippedSlot` is set to null

### Requirement: Item purchase deducts gold and transfers ownership atomically
The system SHALL expose a `buy_item` tool that accepts `characterId`, `npcId`, `itemId`, and `quantity`. Within a single database transaction it SHALL: verify the NPC has sufficient `NpcItem.quantity`, decrement it, create or increment `CharacterItem`, and deduct `quantity × NpcItem.priceInGold` from `Character.gold`. If the character has insufficient gold, the tool SHALL return `{ success: false, reason: "INSUFFICIENT_GOLD" }` without modifying any row.

#### Scenario: Successful purchase transfers item and deducts gold
- **WHEN** the LLM calls `buy_item` and the character has enough gold
- **THEN** the character's gold is decremented, their CharacterItem quantity incremented, and the NPC's NpcItem quantity decremented — all atomically

#### Scenario: Insufficient gold returns structured error
- **WHEN** the character's gold is less than the total cost
- **THEN** the tool returns `{ success: false, reason: "INSUFFICIENT_GOLD" }` and no rows are modified

#### Scenario: NPC without sufficient stock returns structured error
- **WHEN** the NPC's `NpcItem.quantity` is less than the requested `quantity`
- **THEN** the tool returns `{ success: false, reason: "INSUFFICIENT_STOCK" }`

### Requirement: Item sale adds gold and transfers ownership atomically
The system SHALL expose a `sell_item` tool that accepts `characterId`, `npcId`, `itemId`, and `quantity`. Within a single database transaction it SHALL: verify the character has sufficient `CharacterItem.quantity`, decrement it (removing the row if quantity reaches 0), create or increment `NpcItem`, and add `quantity × Item.goldValue` to `Character.gold`.

#### Scenario: Successful sale transfers item and adds gold
- **WHEN** the LLM calls `sell_item` and the character owns the item in sufficient quantity
- **THEN** the character's gold increments by the total sale value and the CharacterItem quantity decrements atomically

#### Scenario: Selling the last unit removes the CharacterItem row
- **WHEN** `sell_item` reduces a `CharacterItem.quantity` to 0
- **THEN** the `CharacterItem` row is deleted

### Requirement: Merchant stock is replaced atomically by restock_merchant
The system SHALL expose a `restock_merchant` tool that accepts `npcId` and an `items` array of `{ itemId, quantity, priceInGold }`. Within a single transaction it SHALL delete all existing `NpcItem` rows for that NPC and insert the provided items. This replaces the merchant's entire inventory.

#### Scenario: Restock replaces all NPC items
- **WHEN** the LLM calls `restock_merchant` with a new item list
- **THEN** all previous `NpcItem` rows for that NPC are deleted and the new items are inserted in a single transaction
