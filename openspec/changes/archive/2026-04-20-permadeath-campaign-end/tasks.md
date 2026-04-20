## 1. Data Model & Migration

- [x] 1.1 Add `CampaignStatus` enum (`ACTIVE` | `ENDED`) to `apps/api/src/campaign/campaign.enums.ts`
- [x] 1.2 Add `status: CampaignStatus`, `endedAt: Date | null`, `endReason: string | null` fields to `Campaign` entity with defaults (`ACTIVE`, `null`, `null`)
- [x] 1.3 Add `entryType: DiaryEntryType` enum (`DAILY` | `MEMORIAL`) to `DiaryEntry` entity with default `DAILY`
- [x] 1.4 Generate MikroORM migration for the new Campaign and DiaryEntry columns
- [x] 1.5 Run migration and verify schema (`yarn mikro-orm migration:up`) — manual step

## 2. Campaign Status GraphQL Surface

- [x] 2.1 Expose `status`, `endedAt`, and `endReason` fields on the `Campaign` GraphQL type
- [x] 2.2 Add `CampaignStatus` enum to the GraphQL schema
- [x] 2.3 Write unit tests for campaign queries returning the new status fields

## 3. CampaignService — endCampaign

- [x] 3.1 Implement `CampaignService.endCampaign(campaignId, reason, epitaph)` — sets `status = ENDED`, stamps `endedAt`, persists `endReason`, guards against double-ending
- [x] 3.2 Inject `SessionService` into `CampaignService`; call `SessionService.endActiveSession(campaignId)` inside `endCampaign` after status is persisted
- [x] 3.3 Write unit tests for `endCampaign` — success path, double-end guard, session teardown

## 4. SessionService — endActiveSession

- [x] 4.1 Add `SessionService.endActiveSession(campaignId: string): Promise<void>` — sets `endedAt` on the active session; no-ops if none exists
- [x] 4.2 Write unit tests for `endActiveSession` — active session ended, no active session is a no-op

## 5. DiaryService — Memorial Entry

- [x] 5.1 Update `DiaryService.writeDiaryEntry` to accept an optional `entryType` parameter (default `DAILY`)
- [x] 5.2 Add a Haiku prompt path for `MEMORIAL` entries — prompt summarises character life and cause of death from the session transcript
- [x] 5.3 Persist memorial entry with `entryType = MEMORIAL`; ensure failure is caught, logged, and does not rethrow
- [x] 5.4 Write unit tests for memorial diary write — success path, Haiku failure does not throw

## 6. DmStreamChunkType — CAMPAIGN_ENDED

- [x] 6.1 Add `CAMPAIGN_ENDED` to the `DmStreamChunkType` enum
- [x] 6.2 Define `CampaignEndedChunkPayload` type with `epitaph: string`, `daysPlayed: number`, `questsCompleted: number`
- [x] 6.3 Implement a helper in `LLMModule` (or session service) to build the `CAMPAIGN_ENDED` chunk from campaign data — queries `daysPlayed` from date diff and `questsCompleted` from Quest count

## 7. end_campaign LLM Tool

- [x] 7.1 Register `end_campaign(campaignId, reason, epitaph)` tool in `GameEngineModule`
- [x] 7.2 Tool handler: call `CampaignService.endCampaign`, emit `CAMPAIGN_ENDED` STATUS chunk, return structured success result
- [x] 7.3 Guard: if campaign is already `ENDED`, return structured error result (no throw)
- [x] 7.4 Write unit tests for `end_campaign` — success, already-ended guard, SSE chunk emission

## 8. Permadeath Auto-End

- [x] 8.1 Inject `CampaignService` and `DiaryService` into the death tool handler (or a new `PermadeathService`)
- [x] 8.2 After `roll_death_save` sets `isDead = true`: check `campaign.deathMode`; if `PERMADEATH`, call `diaryService.writeDiaryEntry(MEMORIAL)` then `campaignService.endCampaign`
- [x] 8.3 After `instant_death` sets `isDead = true`: apply the same `deathMode` check and permadeath end sequence
- [x] 8.4 Emit `CAMPAIGN_ENDED` STATUS chunk with auto-generated epitaph after campaign end
- [x] 8.5 Implement campaign-lock deferral: if `campaignLocked` Redis key is held, defer end sequence until lock is released
- [x] 8.6 Write unit tests — permadeath path ends campaign, STORY path does not, lock deferral

## 9. Frontend — CampaignEndScreen

- [x] 9.1 Create `CampaignEndScreen.vue` full-screen component — displays epitaph, `daysPlayed`, `questsCompleted`, and "Start New Campaign" button
- [x] 9.2 Wire SSE handler in the play route to detect `CAMPAIGN_ENDED` chunk and render `CampaignEndScreen`
- [x] 9.3 On play route mount, query `campaign.status`; if `ENDED`, show `CampaignEndScreen` immediately without SSE
- [x] 9.4 "Start New Campaign" button navigates to the campaign creation flow

## 10. Frontend — Dashboard Memorial Badge

- [x] 10.1 Include `status` in the campaigns list GraphQL query on the dashboard
- [x] 10.2 Render a memorial badge on campaign cards where `status === ENDED`
- [x] 10.3 Disable/remove all action buttons (play, continue setup) for ended campaigns
