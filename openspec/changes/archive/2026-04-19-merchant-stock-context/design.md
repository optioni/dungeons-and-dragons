## Context

`NpcItem` rows exist for merchant stock and lootable NPC inventories, but `ContextLoader` never reads them. Block 3 (world state) is assembled without any NPC inventory data, so the LLM must hallucinate merchant stock when the player enters a shop. `buy_item` and `sell_item` tools can only operate on items the LLM already mentioned — making merchants functionally empty unless the DM invents something.

Block 3 cache invalidation is already triggered by world state changes. All three commerce tools (`buy_item`, `sell_item`, `restock_merchant`) mutate `NpcItem` rows, which means they'll naturally bust the block-3 cache and serve fresh inventory on the next turn — no extra wiring required.

## Goals / Non-Goals

**Goals:**
- Inject NPC inventory into block 3 for NPCs present at `campaign.currentLocationId` that have at least one `NpcItem` row
- Keep the block compact: NPC name, profession, and a flat item list (name, type, quantity, priceInGold)
- Rely on existing cache invalidation — no changes to cache strategy

**Non-Goals:**
- NPCs with zero `NpcItem` rows are excluded — no empty inventory blocks for social NPCs
- No new migrations, entities, or tools
- No per-item description or lore text in the context block (keep tokens low)
- No inventory context for NPCs outside `currentLocationId`

## Decisions

### Where to add the query — `loadWorldBlock()` in `ContextLoader`

Block 3 is the right place: it already contains world and location state, it's invalidated when world data changes, and NPC inventory is world state. Appending to `loadWorldBlock()` keeps the assembly logic co-located with the other world-state queries.

Alternative: a dedicated `loadMerchantBlock()` at a new breakpoint. Rejected — adds cache complexity for a small amount of data that naturally belongs in block 3.

### Filter: NPCs at currentLocationId with ≥1 NpcItem

This excludes purely social NPCs and avoids fetching inventory for distant merchants. The filter is a single join on `npc.locationId = campaign.currentLocationId AND COUNT(npcItem) > 0`.

Alternative: include all NPCs in the current area regardless of items. Rejected — would surface useless empty blocks and increase token waste.

### Format: compact text list

```
Merchant: Aldric the Tinker (merchant)
- Iron dagger (weapon) x2 — 5 gp
- Rope, hempen (adventuring gear) x3 — 1 gp
```

Single-pass template string, no nested structure. Compact enough that a 10-item shop adds ~200–400 tokens to block 3.

Alternative: JSON sub-object. Rejected — LLMs parse prose merchant lists as well as JSON and prose is shorter.

## Risks / Trade-offs

- **Token cost increase at settlement locations** → Mitigation: filter to `currentLocationId` only; exclude zero-item NPCs. A busy market with five merchants and 50 items total adds ~1 500 tokens — acceptable for the DM coherence gain.
- **Stale inventory if cache miss is skipped** → Mitigation: block 3 invalidation already fires after every tool call that mutates NpcItem; no additional logic needed. Risk is low.
- **NPC has items but isn't meant to be a merchant** → Mitigation: lootable NPCs (e.g., a bandit with a sword) will appear in the block, which is correct — the LLM should know the NPC carries that item.

## Migration Plan

1. Add `NpcItem` query inside `ContextLoader.loadWorldBlock()` — filter by `currentLocationId`, eager-load NPC name and profession.
2. Format results as a compact merchant inventory section appended to the world state string.
3. No migration, no schema change, no new module registration needed.
4. Rollback: revert the `loadWorldBlock()` change; no persistent side effects.

## Open Questions

- Should `priceInGold` of `0` render as "free" or be omitted from the block? (Edge case for quest reward items stored as NpcItems.)
