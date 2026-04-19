## ADDED Requirements

### Requirement: NpcMemory persists per-NPC episodic experiences
The system SHALL store a separate `NpcMemory` entity for each recorded NPC experience or piece of received knowledge. Each `NpcMemory` row SHALL include: `npcId`, `content` (text, max 1000 chars), `embedding` (pgvector, nullable until generated), `inGameDate` (nullable narrative string), `sourceNpcId` (nullable FK — the NPC who shared this information), and `createdAt` (real timestamp for ordering). `NpcMemory` is owned by `WorldModule` and is distinct from the `Memory` entity in `MemoryModule`.

#### Scenario: Memory is created with embedding
- **WHEN** a new `NpcMemory` row is created
- **THEN** the system generates a Voyage AI embedding for its `content` and stores it in the `embedding` column

#### Scenario: Memory records the source NPC when knowledge is shared
- **WHEN** an `NpcMemory` row is created as a result of NPC-to-NPC conversation knowledge sharing
- **THEN** `sourceNpcId` is set to the NPC who conveyed the information

#### Scenario: Directly witnessed memories have no source NPC
- **WHEN** an `NpcMemory` row is created from a player interaction via `record_npc_memory`
- **THEN** `sourceNpcId` is null

---

### Requirement: `record_npc_memory` DM session tool records notable NPC experiences
The system SHALL provide a `record_npc_memory` tool available during DM sessions. The tool SHALL accept `npc_id` (integer) and `content` (string) parameters. The tool SHALL create an `NpcMemory` row for the specified NPC with the current campaign in-game date as `inGameDate`. The tool SHALL return a structured result the LLM can use to confirm success or recover from failure.

#### Scenario: Tool records a witnessed event from the player's action
- **WHEN** the DM LLM calls `record_npc_memory` with a valid `npc_id` and `content`
- **THEN** the system creates an `NpcMemory` row for that NPC and returns `{ success: true, data: { id: <number> } }`

#### Scenario: Tool returns structured error for unknown NPC
- **WHEN** the DM LLM calls `record_npc_memory` with an `npc_id` that does not exist in the campaign
- **THEN** the system returns `{ success: false, errorCode: "NPC_NOT_FOUND" }` without throwing

---

### Requirement: World-tick agenda evaluation is enriched with NPC memories
Before each Haiku agenda-evaluation call, the system SHALL retrieve the top `NPC_MEMORY_AGENDA_LIMIT` (default 5, config) semantically relevant `NpcMemory` rows for the NPC being evaluated, using the NPC's current `agenda` as the search query. Retrieved memories SHALL be included in the Haiku prompt alongside the NPC's static fields.

#### Scenario: Agenda call includes relevant memories when they exist
- **WHEN** a world-tick evaluates an NPC whose `NpcMemory` rows exist
- **THEN** the Haiku prompt includes up to `NPC_MEMORY_AGENDA_LIMIT` memories most relevant to the NPC's current agenda

#### Scenario: Agenda call proceeds normally when NPC has no memories
- **WHEN** a world-tick evaluates an NPC with zero `NpcMemory` rows
- **THEN** the Haiku prompt omits the memory section and agenda evaluation completes without error

#### Scenario: Memory limit is respected
- **WHEN** an NPC has more memories than `NPC_MEMORY_AGENDA_LIMIT`
- **THEN** only the top `NPC_MEMORY_AGENDA_LIMIT` by semantic relevance are included

---

### Requirement: NPC conversations produce shared memories
The `ConversationOutcome` interface SHALL include a `sharedMemories` field: an array of `{ receiverNpcId, content, senderNpcId }` objects. The Haiku conversation prompt SHALL be enriched with both participants' top `NPC_MEMORY_CONVERSATION_LIMIT` (default 3, config) memories. If the Haiku response includes shared knowledge in `sharedMemories`, the system SHALL create `NpcMemory` rows for each receiving NPC with `sourceNpcId` set to the sender. These rows SHALL be created in the same atomic `em.flush()` as all other tick outcomes.

#### Scenario: Conversation produces shared memory for receiving NPC
- **WHEN** a world-tick conversation outcome includes a non-empty `sharedMemories` array
- **THEN** an `NpcMemory` row is created for each receiver with `sourceNpcId` referencing the sender, persisted atomically with other tick outcomes

#### Scenario: Conversation with no knowledge sharing creates no memory rows
- **WHEN** a world-tick conversation outcome has an empty `sharedMemories` array
- **THEN** no `NpcMemory` rows are created for the participating NPCs

#### Scenario: Conversation prompt includes both participants' memories
- **WHEN** both participating NPCs have `NpcMemory` rows
- **THEN** the Haiku conversation prompt includes up to `NPC_MEMORY_CONVERSATION_LIMIT` memories per participant
