## 1. QueueModule

- [ ] 1.1 Create `apps/api/src/queue/queue.module.ts` registering the `world-tick` BullMQ queue and Redis `CacheModule`, reading Redis URL from `ConfigService`
- [ ] 1.2 Export `BullModule` and `CacheModule` from `QueueModule` so consumers need only import `QueueModule`
- [ ] 1.3 Import `QueueModule` in `AppModule` and remove any inline BullMQ queue declarations that duplicate it
- [ ] 1.4 Write unit tests for `QueueModule` verifying the queue name and cache export

## 2. WorldTickWorker skeleton

- [ ] 2.1 Create `apps/api/src/world/world-tick.worker.ts` with `@Processor('world-tick')` and a `process(job)` method accepting `{ campaignId }`
- [ ] 2.2 Acquire `ioredis` SETNX lock `campaignLocked:<campaignId>` with 10-minute TTL at the start of `process()`; exit with structured no-op if lock is already held
- [ ] 2.3 Release the lock in a `finally` block unconditionally
- [ ] 2.4 Register `WorldTickWorker` as a provider in `WorldModule` and import `QueueModule`
- [ ] 2.5 Write unit tests for lock acquisition, lock contention (no-op exit), and lock release in `finally`

## 3. NPC agenda evaluation

- [ ] 3.1 Add `maxNpcsPerTick` config value (default 10) to `environment.validation.ts` and `ConfigService`
- [ ] 3.2 Implement `WorldService.getDueNpcs(campaignId, inGameDate, limit)` — returns NPCs whose `nextTickInGameDate` ≤ `inGameDate`, ordered by earliest date first, capped at `limit`
- [ ] 3.3 Implement agenda grouping: separate NPCs by `currentLocationId` into independent sets (different locations) and co-located sets (same location)
- [ ] 3.4 Implement `WorldTickWorker.evaluateAgendas()` — parallel Haiku calls for independent NPCs, sequential for co-located; each call receives NPC context + current in-game date; returns array of structured outcomes `{ npcId, agenda, nextTickInGameDate, newLocationId?, departureDescription? }`
- [ ] 3.5 Write unit tests for `getDueNpcs` (overdue, future-dated, null `nextTickInGameDate`, cap enforcement)
- [ ] 3.6 Write unit tests for agenda grouping (independent vs co-located batching)

## 4. NPC movement and departure events

- [ ] 4.1 Implement departure `WorldEvent` creation within outcome collection: for each outcome with `newLocationId`, build a `WorldEvent` object `{ campaignId, locationId: currentLocationId, source: WORLD_TICK, description: departureDescription }`
- [ ] 4.2 Ensure `Npc.currentLocationId` and the departure `WorldEvent` are both included in the atomic outcome batch (not flushed separately)
- [ ] 4.3 Write unit tests for departure event construction (with destination disclosed, without destination, no movement)

## 5. NPC conversations

- [ ] 5.1 Implement `WorldService.getConversationPairs(campaignId)` — queries `NpcRelationship` rows where source and target share `currentLocationId`; returns pairs sorted by relationship type priority (ENEMY/RIVAL → ALLY/MENTOR/STUDENT/FAMILY → NEUTRAL), tiebroken by least-recently-conversed
- [ ] 5.2 Add `lastConversedAt` nullable timestamp to `Npc` entity and generate a MikroORM migration
- [ ] 5.3 Implement `WorldTickWorker.runConversations(pairs)` — for each pair (one per NPC max), run a 2-turn Haiku dialogue; extract structured outcome `{ relationshipChange?, itemExchanged?, newAgendaSource?, newAgendaTarget? }`
- [ ] 5.4 Collect conversation outcomes into the shared outcome batch; update `Npc.lastConversedAt` for both participants
- [ ] 5.5 Write unit tests for `getConversationPairs` (co-located pairs, different-location exclusion, priority ordering, one-conversation-per-NPC limit)
- [ ] 5.6 Write unit tests for conversation outcome merging (relationship change, item exchange, agenda update, empty outcome no-op)

## 6. Atomic outcome application

- [ ] 6.1 Implement `WorldTickWorker.applyOutcomes(outcomes)` — applies all collected NPC field updates, new `WorldEvent` rows, `NpcRelationship` changes, and `NpcItem` transfers in a single `em.flush()` call
- [ ] 6.2 Write unit tests verifying that agenda and conversation outcomes are merged into one batch before flush, and that a flush failure leaves no partial state

## 7. Catastrophe system

- [ ] 7.1 Implement `trigger_catastrophe` as a tool in `GameEngineModule` (or a dedicated `WorldTickToolsService`), available only during world tick Haiku calls; the tool creates a `WorldEvent` with `source: CATASTROPHE`, `status: ACTIVE`, Haiku-generated `description`, and optional `locationId`
- [ ] 7.2 Implement `WorldTickWorker.rollCatastrophe(campaignId)` — calls Haiku with campaign state + recent `WorldEvent` rows + ~5% probability framing; passes `trigger_catastrophe` as an available tool
- [ ] 7.3 Ensure `trigger_catastrophe` is NOT included in the DM session tool list
- [ ] 7.4 Write unit tests for `trigger_catastrophe` tool (creates CATASTROPHE WorldEvent with locationId, without locationId)
- [ ] 7.5 Write unit tests verifying `trigger_catastrophe` is absent from DM session tools

## 8. Diary entry (post-tick)

- [ ] 8.1 Invoke `MemoryModule.writeDiaryEntry(campaignId)` as the final step in `WorldTickWorker.process()`, after catastrophe roll completes
- [ ] 8.2 Ensure diary write failure does not throw and does not roll back the already-committed tick outcomes (fire-and-forget with structured error logging)
- [ ] 8.3 Write unit tests verifying diary write is called last and that its failure is caught without affecting the job result

## 9. Integration

- [ ] 9.1 Write an integration test: enqueue a `world-tick` job for a campaign with one overdue NPC, verify NPC agenda fields are updated and a diary entry is created
- [ ] 9.2 Write an integration test: enqueue two concurrent `world-tick` jobs for the same campaign, verify the second exits as a no-op (Redis lock)
- [ ] 9.3 Write an integration test: NPC with `newLocationId` outcome produces a departure `WorldEvent` at the old location and updates `Npc.currentLocationId`
