## Why

NPCs currently have no episodic memory — their `agenda` field encodes what they are pursuing but not what they have witnessed, experienced, or been told. World-tick Haiku calls receive only static NPC fields (motivation, traits, current agenda), meaning player actions and NPC-to-NPC knowledge sharing have no lasting effect on how NPCs reason and behave.

## What Changes

- New `NpcMemory` entity in `WorldModule` — separate from the existing `Memory` table, which stores campaign-level facts. `NpcMemory` stores what an individual NPC has experienced or been told, with pgvector embeddings for semantic retrieval.
- `record_npc_memory(npcId, content)` tool added to the DM session tool list — called by the LLM when the player does something notable in the presence of NPCs (combat, theft, acts of kindness, public declarations, etc.).
- World-tick agenda evaluation enriched with relevant NPC memories — before each Haiku agenda call, the most relevant `NpcMemory` rows for that NPC are fetched via semantic search and included as context.
- NPC conversations can produce shared memories — the structured conversation outcome gains a `sharedMemories[]` field; each entry creates an `NpcMemory` for the receiving NPC with `sourceNpcId` tracking who told them.
- Active scene context enriched with NPC memories — when an NPC is present in the current scene, semantically relevant memories are included in the LLM prompt so their dialogue reflects what they know.

## Capabilities

### New Capabilities

- `npc-episodic-memory`: Storage, retrieval, and propagation of per-NPC memories — what NPCs have witnessed from the player, and what they have learned from other NPCs. Covers the entity, embedding pipeline, DM tool, world-tick integration, conversation outcome extension, and scene context assembly.

### Modified Capabilities

- `world-tick`: Agenda evaluation now includes semantic NPC memory retrieval before each Haiku call; conversation outcomes gain a `sharedMemories[]` field.
- `llm-context-assembly`: Active scene NPC context includes relevant `NpcMemory` rows alongside existing NPC entity fields.

## Impact

- **New entity**: `NpcMemory` — new table + pgvector column, MikroORM migration required
- **WorldModule**: new `NpcMemoryService` (or extension of `WorldService`) for CRUD and semantic search; conversation outcome type extended
- **GameEngineModule**: new `record_npc_memory` tool registered alongside existing memory tools
- **LLMModule / context-loader**: scene context assembly updated to fetch and include NPC memories
- **WorldTickWorker**: agenda evaluation step updated to fetch memories before Haiku call; conversation outcome processing creates `NpcMemory` rows
- **Dependencies**: Voyage AI embedding (already in use via `EmbeddingService`) — no new dependencies
