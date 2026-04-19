## ADDED Requirements

### Requirement: NPC inventory for merchants at current location is included in world-state context
The system SHALL query `NpcItem` rows for all NPCs whose `locationId` matches the active campaign's `currentLocationId`. Only NPCs with at least one `NpcItem` row SHALL have an inventory block included. The inventory block SHALL be appended to the world-state section (block 3) of the assembled prompt.

#### Scenario: Merchant at current location has stock injected into context
- **WHEN** the campaign's `currentLocationId` matches an NPC's location and that NPC has at least one `NpcItem` row
- **THEN** the assembled prompt includes that NPC's name, profession, and a flat item list with name, type, quantity, and priceInGold

#### Scenario: NPC with no items is excluded from the inventory block
- **WHEN** an NPC is located at `currentLocationId` but has zero `NpcItem` rows
- **THEN** no inventory block is emitted for that NPC

#### Scenario: No merchants at current location produces no inventory section
- **WHEN** no NPC at `currentLocationId` has any `NpcItem` rows
- **THEN** the world-state block is assembled without any merchant inventory section and context assembly succeeds

#### Scenario: Multiple merchants produce individual inventory blocks
- **WHEN** two or more NPCs at `currentLocationId` each have at least one `NpcItem` row
- **THEN** the assembled prompt includes a separate inventory block for each NPC, each labelled with that NPC's name and profession

### Requirement: Merchant inventory context reflects post-tool-call state on next turn
The system SHALL rely on existing block-3 cache invalidation to serve fresh inventory. After any tool call that mutates `NpcItem` rows (`buy_item`, `sell_item`, `restock_merchant`), the cache layer at breakpoint 3 SHALL be invalidated and rebuilt on the next player turn.

#### Scenario: Inventory is updated after buy_item
- **WHEN** the LLM executes `buy_item` and the player submits the next turn
- **THEN** the assembled world-state context reflects the reduced quantity (or removed item) resulting from the purchase

#### Scenario: Inventory is updated after restock_merchant
- **WHEN** the LLM executes `restock_merchant` and the player submits the next turn
- **THEN** the assembled world-state context reflects the restocked items added to the merchant's inventory
