## Why

`NpcItem` stores merchant stock and lootable NPC inventories, but this data is never injected into the LLM context. When the player enters a shop, the DM doesn't know what's for sale and must hallucinate inventory. `buy_item` and `sell_item` tools exist but can only be called for items the LLM already knows about — meaning merchants are effectively empty unless the DM invents their stock.

## What Changes

- `ContextLoader` (block 3 — world state) extended to include NPC inventory for NPCs present at the campaign's `currentLocationId`.
- Only NPCs with at least one `NpcItem` row (merchants and lootable NPCs) have their inventory included — purely social NPCs generate no inventory block.
- Inventory block format: NPC name, profession, then a list of items with name, type, quantity, and `priceInGold`. Kept compact to minimise token cost.
- `restock_merchant` tool already exists in the game engine; this change ensures the restocked inventory is visible in context on the next turn.
- Block 3 cache invalidation already fires when world state changes — NPC inventory updates (after `restock_merchant`, `buy_item`, `sell_item`) will naturally invalidate the cache block and reload fresh stock.

## Capabilities

### New Capabilities
- `merchant-inventory-context`: NPC items for merchants at the current location are injected into the LLM world-state context block.

### Modified Capabilities
- `llm-context-assembly` (block 3): Query `NpcItem` for NPCs at `currentLocationId` with at least one item; format as a compact inventory list appended to the world state block.

## Impact

- `ContextLoader.loadWorldBlock()` — add `NpcItem` query for merchant NPCs at current location
- No new entities, migrations, or tools
- Minor token cost increase per turn when at a settlement with merchants (proportional to stock size)
- Depends on `session-and-llm`, `world-system`
