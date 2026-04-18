## 1. Database Migration

- [ ] 1.1 Create MikroORM migration adding `quest` table with columns: `id`, `campaign_id`, `title`, `description`, `status` (enum: ACTIVE/COMPLETED/FAILED), `agenda_impact`, `reward_narrative`, `reward_xp`, `reward_gold`, `created_at`
- [ ] 1.2 Add `quest_objective` table with columns: `id`, `quest_id`, `description`, `type` (enum: REACH_LOCATION/NPC_DEAD/NPC_ALIVE/HAVE_ITEM/TALK_TO_NPC/MANUAL), `status` (enum: INCOMPLETE/COMPLETE), `entity_id`, `order`
- [ ] 1.3 Add `quest_entity` table with columns: `id`, `quest_id`, `entity_type` (enum: NPC/LOCATION/ITEM/WORLD_EVENT), `entity_id` — no FK constraints on `entity_id`
- [ ] 1.4 Add composite index on `quest(campaign_id, status)`
- [ ] 1.5 Add composite index on `quest_objective(quest_id, status)`
- [ ] 1.6 Add index on `quest_entity(quest_id)`
- [ ] 1.7 Add composite index on `quest_entity(entity_type, entity_id)`

## 2. MikroORM Entities

- [ ] 2.1 Create `Quest` entity with all fields, `status` defaulting to `ACTIVE`, and `ManyToOne` to `Campaign`
- [ ] 2.2 Create `QuestObjective` entity with all fields, `status` defaulting to `INCOMPLETE`, and `ManyToOne` to `Quest`
- [ ] 2.3 Create `QuestEntity` entity with `questId`, `entityType`, `entityId` — no ORM-level FK on `entityId`
- [ ] 2.4 Add `QuestStatusEnum`, `QuestObjectiveTypeEnum`, `QuestObjectiveStatusEnum`, `QuestEntityTypeEnum` TypeScript enums
- [ ] 2.5 Register `Quest`, `QuestObjective`, `QuestEntity` in `MikroORM` entity list in app config

## 3. QuestModule Setup

- [ ] 3.1 Scaffold `QuestModule` (`apps/api/src/quest/quest.module.ts`) exporting `QuestService`
- [ ] 3.2 Import `QuestModule` in `GameEngineModule` and `AppModule`
- [ ] 3.3 Add `Quest`, `QuestObjective`, `QuestEntity` to the `MikroOrmModule.forFeature()` array in `QuestModule`

## 4. QuestService — Core Logic

- [ ] 4.1 Implement `QuestService.createQuest(dto)`: wrap NPC/Location/Item/WorldEvent creation + QuestEntity linking + QuestObjective creation in `em.transactional()`; resolve `entityRef` keys to newly created entity IDs; return `{ success, quest }` or `{ success: false, reason }`
- [ ] 4.2 Implement `QuestService.completeQuest(questId)`: set `Quest.status = COMPLETED`, call `applyAgendaImpact` if `agendaImpact` is non-null, return updated quest or `{ success: false, reason: 'QUEST_NOT_FOUND' }`
- [ ] 4.3 Implement `QuestService.failQuest(questId)`: set `Quest.status = FAILED`, call `applyAgendaImpact` if non-null, return updated quest or `{ success: false, reason: 'QUEST_NOT_FOUND' }`
- [ ] 4.4 Implement `QuestService.applyAgendaImpact(questId)`: load all NPC-typed `QuestEntity` rows for the quest, call `update_npc` logic for each linked NPC with the `agendaImpact` string
- [ ] 4.5 Implement `QuestService.updateQuestObjective(objectiveId, status)`: update `QuestObjective.status`, return updated objective or `{ success: false, reason: 'OBJECTIVE_NOT_FOUND' }`
- [ ] 4.6 Implement `QuestService.runAutoChecker(campaignId)`: query INCOMPLETE objectives of ACTIVE quests scoped to campaign; evaluate each against current world state using the type-specific rules; set `status = COMPLETE` for met objectives; return `{ questCompleted: { questId, questTitle } }` when all objectives of a quest become complete, otherwise `null`

## 5. Auto-checker Objective Evaluators

- [ ] 5.1 Implement `REACH_LOCATION` evaluator: check `Character.currentLocationId === objective.entityId`
- [ ] 5.2 Implement `NPC_DEAD` evaluator: check `Npc.alive === false` for `objective.entityId`
- [ ] 5.3 Implement `NPC_ALIVE` evaluator: check `Npc.alive === true` for `objective.entityId`
- [ ] 5.4 Implement `HAVE_ITEM` evaluator: check `CharacterItem` exists for `objective.entityId` in campaign character's inventory
- [ ] 5.5 Confirm `TALK_TO_NPC` and `MANUAL` objective types are skipped (no auto-evaluation)

## 6. GameEngine Integration

- [ ] 6.1 Add `QuestService` constructor parameter to `GameEngineToolRegistrar`
- [ ] 6.2 Add private `runQuestAutoChecker(campaignId)` helper in `GameEngineToolRegistrar` that calls `QuestService.runAutoChecker` and merges any `questCompleted` signal into the `ToolResult`
- [ ] 6.3 Call `runQuestAutoChecker` at the end of `travel_to` execute handler
- [ ] 6.4 Call `runQuestAutoChecker` at the end of `apply_damage` execute handler
- [ ] 6.5 Call `runQuestAutoChecker` at the end of `give_item` execute handler
- [ ] 6.6 Call `runQuestAutoChecker` at the end of `update_npc` execute handler
- [ ] 6.7 Add `questCompleted?: { questId: string; questTitle: string }` field to the `ToolResult` type

## 7. LLM Tools Registration

- [ ] 7.1 Register `create_quest` tool in `GameEngineToolRegistrar` with full input schema (campaignId, title, description, agendaImpact, rewards, objectives array, npcs/locations/items/worldEvents scaffold arrays)
- [ ] 7.2 Register `complete_quest` tool with `questId` input; delegate to `QuestService.completeQuest`
- [ ] 7.3 Register `fail_quest` tool with `questId` input; delegate to `QuestService.failQuest`
- [ ] 7.4 Register `update_quest_objective` tool with `objectiveId` and `status` inputs; delegate to `QuestService.updateQuestObjective`

## 8. GraphQL API

- [ ] 8.1 Create `Quest` GraphQL object type with all fields including nested `objectives` and `entities`
- [ ] 8.2 Create `QuestObjective` GraphQL object type
- [ ] 8.3 Create `QuestEntity` GraphQL object type
- [ ] 8.4 Create relay connection types for `Quest` using shared helpers from `apps/api/src/graphql/relay/`
- [ ] 8.5 Implement `QuestResolver.quests(campaignId, status?, connectionArgs)` query with owner-scoped access check and relay pagination
- [ ] 8.6 Implement `QuestResolver.quest(id)` query returning a single quest with objectives and linked entities, owner-scoped
- [ ] 8.7 Guard all quest queries with `AuthGuard` and validate campaign ownership

## 9. Web — Quests Page

- [ ] 9.1 Create `apps/web/pages/campaign/[id]/quests.vue` page component
- [ ] 9.2 Add urql `questsQuery` composable fetching active quests and completed/failed quests for the campaign
- [ ] 9.3 Render "Active Quests" section with quest cards; show empty-state when none
- [ ] 9.4 Render "Completed" collapsible section with completed/failed quest cards
- [ ] 9.5 Implement quest card component showing title, description, ordered objective checklist with INCOMPLETE/COMPLETE visual indicators, and rewards on completed quests
- [ ] 9.6 Add "Quests" link to campaign navigation sidebar/tab bar with active state when on the quests page

## 10. Tests

- [ ] 10.1 Unit test `QuestService.createQuest`: verify atomicity (transaction rollback on partial failure), QuestEntity linking, entityRef resolution
- [ ] 10.2 Unit test `QuestService.runAutoChecker`: verify each objective type evaluator, questCompleted signal on full completion, no signal when partial
- [ ] 10.3 Unit test `QuestService.completeQuest` / `failQuest`: verify status change and agendaImpact delegation
- [ ] 10.4 Unit test `GameEngineToolRegistrar` auto-checker hook: verify runQuestAutoChecker is called after each of the four state-changing tools and questCompleted is merged into ToolResult
- [ ] 10.5 Integration test `quests` GraphQL query: verify owner scoping, relay pagination shape, status filtering
