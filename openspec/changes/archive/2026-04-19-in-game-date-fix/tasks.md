## 1. Entity Updates

- [x] 1.1 Add `inGameDay: number = 1` property to `Campaign` entity (`apps/api/src/campaign/entities/campaign.entity.ts`) with `@Property()` decorator
- [x] 1.2 Replace `nextTickInGameDate: string | null` with `nextTickInGameDay: number | null` on `Npc` entity (`apps/api/src/world/entities/npc.entity.ts`), updating the JSDoc comment

## 2. Database Migration

- [x] 2.1 Run `cd apps/api && yarn mikro-orm migration:create` to generate the migration skeleton
- [x] 2.2 Verify the generated migration adds `in_game_day INTEGER NOT NULL DEFAULT 1` to `campaign`, drops `next_tick_in_game_date` from `npc`, and adds `next_tick_in_game_day INTEGER NULL` to `npc`
- [x] 2.3 Run `cd apps/api && yarn mikro-orm migration:up` to apply the migration

## 3. WorldService — getDueNpcs

- [x] 3.1 Update `getDueNpcs` signature in `apps/api/src/world/world.service.ts` to accept `inGameDay: number` instead of `inGameDate: string`
- [x] 3.2 Update the MikroORM query in `getDueNpcs` to filter `{ nextTickInGameDay: { $lte: inGameDay, $ne: null } }` and order by `nextTickInGameDay ASC`
- [x] 3.3 Update the JSDoc on `getDueNpcs` to reflect the integer comparison

## 4. WorldTickWorker

- [x] 4.1 Update `AgendaOutcome` type in `apps/api/src/world/world-tick.worker.ts` to use `nextTickInGameDay: number` instead of `nextTickInGameDate: string`
- [x] 4.2 Replace `campaign.inGameDate` with `campaign.inGameDay` when calling `getDueNpcs` and passing context to `evaluateAgendas`
- [x] 4.3 Update the Haiku prompt in `evaluateAgendas` to pass `inGameDay` (integer) instead of the narrative date string when requesting the next tick day
- [x] 4.4 Update outcome application to set `npc.nextTickInGameDay` (integer) from the Haiku response instead of `npc.nextTickInGameDate`

## 5. RestService — takeLongRest

- [x] 5.1 Update `takeLongRest` in `apps/api/src/game-engine/rest.service.ts` to increment `campaign.inGameDay += 1` alongside the existing `inGameDate` string advance

## 6. CampaignSetupService — World Seed

- [x] 6.1 Update `apps/api/src/campaign/campaign.setup.service.ts` world seed persist step to set `campaign.inGameDay = 1` when saving the seed

## 7. Tests

- [x] 7.1 Update `apps/api/src/world/world.service.spec.ts` — replace `nextTickInGameDate` string fixtures with `nextTickInGameDay` integers and update `getDueNpcs` call signatures
- [x] 7.2 Update `apps/api/src/world/world-tick.worker.spec.ts` — replace `inGameDate` / `nextTickInGameDate` fixtures with `inGameDay` / `nextTickInGameDay` integers throughout all test cases
- [x] 7.3 Run `cd apps/api && yarn test` and confirm all tests pass
