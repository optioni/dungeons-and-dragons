## 1. Inject NpcItem Repository into ContextLoader

- [x] 1.1 Add `NpcItem` to the `@InjectRepository` imports in `ContextLoader` constructor (`apps/api/src/llm/context-loader.service.ts`)
- [x] 1.2 Register `NpcItem` entity in `LlmModule`'s `MikroOrmModule.forFeature([...])` array so the repository is available for injection

## 2. Extend loadWorldBlock with Merchant Inventory

- [x] 2.1 In `loadWorldBlock`, query `NpcItem` rows joined to `Npc` where `npc.location = campaign.currentLocationId`, grouping by NPC — only include NPCs with at least one item row
- [x] 2.2 Format results as a compact `## Merchant Inventory` section: each NPC on its own sub-heading with name and profession, followed by a flat item list (`- <name> (<type>) x<qty> — <price> gp`)
- [x] 2.3 Append the merchant inventory section to `parts` in `loadWorldBlock` only when at least one merchant-with-items is found; produce no section when the result set is empty
- [x] 2.4 Load the active campaign inside `loadWorldBlock` (already available via `campaignId`) to read `currentLocationId` — avoid an extra network call by reusing the existing campaign fetch if one already exists in the method

## 3. Unit Tests

- [x] 3.1 Add a test in `context-loader.service.spec.ts`: when NPCs with items are present at `currentLocationId`, `loadWorldBlock` output contains the merchant inventory section with correct NPC name, item name, quantity, and price
- [x] 3.2 Add a test: when an NPC is at `currentLocationId` but has zero items, no inventory block is emitted for that NPC
- [x] 3.3 Add a test: when no NPC at `currentLocationId` has items, `loadWorldBlock` succeeds and contains no merchant inventory section
- [x] 3.4 Add a test: when multiple merchant NPCs are present, each gets its own inventory block in the output

## 4. Verify Cache Invalidation

- [x] 4.1 Confirm that `buy_item`, `sell_item`, and `restock_merchant` tool handlers already trigger block-3 cache invalidation (i.e., they mutate `NpcItem` rows and the campaign's world-state version/timestamp is bumped, or the block is unconditionally rebuilt per turn for block 3) — document the finding in a code comment if no explicit invalidation hook exists
