## ADDED Requirements

### Requirement: Item entity represents a single inventory object
The system SHALL persist an `Item` entity with: name (text), description (text), weight (float, nullable), value (integer, in copper pieces, nullable), itemType (enum: WEAPON, ARMOR, SHIELD, POTION, SCROLL, WONDROUS, TOOL, GEAR, CURRENCY, OTHER), srdEquipment (FK → SrdEquipment, nullable). Items are created exclusively by game engine tool call handlers — the player has no direct mutation to create items.

#### Scenario: A narrative item with no SRD equivalent is persisted
- **WHEN** the game engine calls the internal `grantItem` handler with a name and description but no srdEquipmentId
- **THEN** an Item row is created with `srdEquipment` null and all provided fields stored

#### Scenario: An SRD-linked item is persisted
- **WHEN** the game engine grants a Longsword (a known SrdEquipment index)
- **THEN** an Item row is created with `srdEquipment` FK pointing to the Longsword SrdEquipment row

### Requirement: CharacterItem join entity tracks ownership and equip state
The system SHALL persist a `CharacterItem` entity linking a `Character` to an `Item` with: slot (enum: MAIN_HAND, OFF_HAND, HEAD, CHEST, HANDS, FEET, RING_1, RING_2, NECK, BACK; nullable — null means carried but not equipped), condition (text, nullable). A database unique partial index SHALL enforce that no two CharacterItem rows share the same (characterId, slot) pair when slot IS NOT NULL.

#### Scenario: Carrying an item does not require a slot
- **WHEN** the game engine grants an item to a character without specifying a slot
- **THEN** a CharacterItem is created with `slot` null

#### Scenario: Two items cannot occupy the same slot
- **WHEN** the game engine attempts to equip a second item to MAIN_HAND when one is already equipped there
- **THEN** the operation fails with a slot-conflict error and neither item is moved

#### Scenario: Unequipping an item sets slot to null
- **WHEN** `unequipItem` mutation is called for an equipped CharacterItem
- **THEN** that CharacterItem's `slot` is set to null and the item remains in inventory

### Requirement: equipItem mutation assigns a slot to a CharacterItem
The system SHALL expose an `equipItem(characterItemId: ID!, slot: EquipSlot!)` GraphQL mutation (authenticated, campaign-owner only). The mutation SHALL: verify the CharacterItem belongs to the authenticated user's character, verify the target slot is vacant, assign the slot within a transaction, and return the updated CharacterItem. If the slot is occupied the mutation SHALL return a structured error the client can display.

#### Scenario: Owner equips an unequipped item to a vacant slot
- **WHEN** the owner calls `equipItem` with a valid characterItemId and a vacant slot
- **THEN** the CharacterItem's slot is updated and the mutation returns the updated CharacterItem

#### Scenario: Equipping to an occupied slot returns an error
- **WHEN** the owner calls `equipItem` targeting a slot already occupied by another item
- **THEN** the mutation returns a user-facing error message; no slot assignments change

#### Scenario: Non-owner cannot equip items
- **WHEN** a user calls `equipItem` for a characterItem belonging to another user's character
- **THEN** a forbidden error is returned

### Requirement: unequipItem mutation removes a slot assignment
The system SHALL expose an `unequipItem(characterItemId: ID!)` GraphQL mutation (authenticated, campaign-owner only) that sets the CharacterItem's slot to null. The item remains in the character's inventory.

#### Scenario: Owner unequips an equipped item
- **WHEN** the owner calls `unequipItem` for an equipped CharacterItem
- **THEN** the CharacterItem's `slot` becomes null and the item remains associated with the character

#### Scenario: Calling unequipItem on an already-unequipped item is a no-op
- **WHEN** the owner calls `unequipItem` for a CharacterItem with slot null
- **THEN** the mutation succeeds and the CharacterItem is returned unchanged

### Requirement: Character inventory query returns all items with equip state
The system SHALL expose a `characterInventory(characterId: ID!)` GraphQL query (authenticated, campaign-owner only) returning a list of CharacterItem objects, each including the nested Item and the current slot value. The list SHALL include both equipped and carried items.

#### Scenario: Inventory includes all items regardless of equip state
- **WHEN** a character has 3 items — one equipped, two carried — and the owner queries `characterInventory`
- **THEN** all 3 CharacterItem records are returned with their respective slot values

#### Scenario: Empty inventory returns an empty list
- **WHEN** a character has no items and the owner queries `characterInventory`
- **THEN** an empty list is returned without error

### Requirement: Currency is tracked on the Character entity
Currency SHALL be stored as three integer fields on the `Character` entity: `goldPieces`, `silverPieces`, `copperPieces` (all default 0). Currency is modified exclusively by game engine tool calls via `updateCharacterState`. No separate currency mutation exists.

#### Scenario: Character starts with zero currency
- **WHEN** a character is created
- **THEN** `goldPieces`, `silverPieces`, and `copperPieces` are all 0

#### Scenario: Game engine can credit gold to a character
- **WHEN** the game engine calls `updateCharacterState` with `{ goldPieces: 50 }`
- **THEN** the character's `goldPieces` is updated to 50 in subsequent queries

### Requirement: Web character sheet displays inventory and currency
The character sheet page at `/campaign/[id]/character` SHALL include an inventory section listing all CharacterItem rows with item name, type, condition (if set), and equipped slot (or "Carried"). Currency SHALL be displayed as gp / sp / cp. Equip and unequip actions SHALL be available from the inventory list.

#### Scenario: Equipped items show their slot
- **WHEN** the character sheet is displayed and a Longsword is in slot MAIN_HAND
- **THEN** the Longsword row shows "Main Hand" as its slot label

#### Scenario: Player can unequip an item from the character sheet
- **WHEN** the player clicks unequip on an equipped item
- **THEN** `unequipItem` is called, the UI updates to show the item as "Carried"

#### Scenario: Currency is displayed in all three denominations
- **WHEN** the character has 10 gp, 5 sp, 3 cp
- **THEN** the character sheet shows "10 gp  5 sp  3 cp"
