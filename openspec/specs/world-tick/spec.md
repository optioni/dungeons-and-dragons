# World Tick

## Purpose

Defines the background job infrastructure that implements the world tick system: queue management, worker processing pipeline, Redis locking, NPC agenda cap management, and atomic outcome application. This spec covers the orchestration of agenda evaluation, conversations, catastrophe rolls, and diary entry generation.

## Requirements

### Requirement: QueueModule registers the world-tick BullMQ queue and Redis cache
The system SHALL provide a `QueueModule` that registers a BullMQ queue named `world-tick` and a Redis-backed `CacheModule`. `QueueModule` SHALL export both so that `WorldModule` and `SessionModule` can import them without re-declaring the queue or cache. `QueueModule` SHALL read its Redis connection URL from `ConfigService` (no hardcoded values).

#### Scenario: WorldModule can enqueue a world-tick job
- **WHEN** `WorldModule` imports `QueueModule`
- **THEN** it can inject `@InjectQueue('world-tick')` and call `.add()` without registering the queue itself

#### Scenario: SessionModule can enqueue a world-tick job
- **WHEN** `SessionModule` imports `QueueModule`
- **THEN** it can inject `@InjectQueue('world-tick')` and call `.add()` without a circular dependency on `WorldModule`

### Requirement: World tick job executes a sequenced background process
The system SHALL provide a `WorldTickWorker` (`@Processor('world-tick')`) inside `WorldModule`. The worker SHALL process jobs in strict sequence: (1) NPC agenda evaluation, (2) NPC conversations, (3) atomic outcome application, (4) catastrophe roll, (5) diary entry write. Each step SHALL complete before the next begins. The worker SHALL accept a job payload containing `campaignId`.

#### Scenario: Tick steps execute in order
- **WHEN** a `world-tick` job is dequeued for a campaign
- **THEN** NPC agendas are evaluated before conversations run, conversations complete before outcomes are flushed, the catastrophe roll follows the flush, and the diary entry is written last

#### Scenario: Worker handles a campaign with no due NPCs gracefully
- **WHEN** a `world-tick` job runs for a campaign where no NPC has a `nextTickInGameDate` that has passed
- **THEN** the agenda and conversation steps produce no outcomes, the flush is a no-op, the catastrophe roll still runs, and a diary entry is still written

### Requirement: Redis lock prevents overlapping world ticks for the same campaign
The system SHALL acquire an `ioredis` SETNX lock keyed `campaignLocked:<campaignId>` with a TTL of 10 minutes before beginning tick processing. If the lock is already held, the job SHALL exit immediately with a structured no-op result without processing any steps. The lock SHALL be released in a `finally` block after all steps complete or fail.

#### Scenario: Concurrent tick is rejected when lock is held
- **WHEN** a `world-tick` job starts while `campaignLocked:<campaignId>` is already set in Redis
- **THEN** the job exits immediately with a no-op result and does not mutate any entity

#### Scenario: Lock is always released after tick completes
- **WHEN** a `world-tick` job finishes (whether successfully or with an error in any step)
- **THEN** the `campaignLocked:<campaignId>` key is deleted from Redis

#### Scenario: Lock expires automatically if the worker crashes
- **WHEN** a `world-tick` job is processing and the worker process dies before releasing the lock
- **THEN** the lock TTL of 10 minutes elapses and subsequent jobs for that campaign can proceed normally

### Requirement: NPC agenda cap limits Haiku calls per tick
The system SHALL process at most `maxNpcsPerTick` NPCs per tick (default 10, configurable via `ConfigService`). When more NPCs are due, the system SHALL prioritise by most-overdue `nextTickInGameDay` (lowest integer value first). NPCs not processed in a given tick remain eligible and will be prioritised in subsequent ticks.

#### Scenario: Only the most-overdue NPCs are processed when cap is reached
- **WHEN** a campaign has 15 NPCs with overdue agendas and `maxNpcsPerTick` is 10
- **THEN** the 10 NPCs with the lowest `nextTickInGameDay` are processed and the remaining 5 retain their current `nextTickInGameDay` for the next tick

#### Scenario: All due NPCs are processed when count is within cap
- **WHEN** a campaign has 6 NPCs with overdue agendas and `maxNpcsPerTick` is 10
- **THEN** all 6 NPCs are evaluated in the agenda step

### Requirement: Worker handles a campaign with no due NPCs gracefully
The system SHALL handle the case where no NPC has `nextTickInGameDay <= campaign.inGameDay`. In this case the agenda and conversation steps SHALL produce no outcomes, the flush SHALL be a no-op, the catastrophe roll SHALL still run, and a diary entry SHALL still be written.

#### Scenario: Worker handles a campaign with no due NPCs gracefully
- **WHEN** a `world-tick` job runs for a campaign where no NPC has `nextTickInGameDay <= campaign.inGameDay`
- **THEN** the agenda and conversation steps produce no outcomes, the flush is a no-op, the catastrophe roll still runs, and a diary entry is still written

### Requirement: All tick outcomes are applied atomically
The system SHALL collect all outcome objects from the agenda and conversation steps (NPC field updates, new WorldEvent rows, NpcRelationship changes) and apply them in a single `EntityManager.flush()` call. No intermediate partial state SHALL be persisted between steps.

#### Scenario: Partial failure does not leave inconsistent state
- **WHEN** the outcome application flush fails mid-tick
- **THEN** no partial NPC or WorldEvent updates are committed for that tick

#### Scenario: Agenda and conversation outcomes are merged before flush
- **WHEN** both the agenda step and conversation step produce outcomes for the same tick
- **THEN** all outcomes are collected into a single batch and written in one flush after both steps complete
