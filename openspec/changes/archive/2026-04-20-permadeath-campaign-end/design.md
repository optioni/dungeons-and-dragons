## Context

Currently, `Campaign.deathMode` is set to either PERMADEATH or STORY, but death resolution (`roll_death_save`, `instant_death`) has no branching logic after setting `isDead = true`. The session continues uninterrupted, no memorial is written, and no campaign-end state is persisted. The frontend has no concept of a concluded campaign.

This design closes that gap: a campaign lifecycle (`ACTIVE → ENDED`) is introduced, two distinct flows drive it (auto-triggered permadeath vs. explicit LLM tool call for STORY), and the frontend surfaces the end state as a full-screen memorial.

Stakeholders: solo-player experience — permadeath only has weight if it truly ends the campaign.

## Goals / Non-Goals

**Goals:**
- Add `CampaignStatus` enum (ACTIVE | ENDED) with `endedAt` and `endReason` to Campaign
- Implement `end_campaign` LLM tool in GameEngineModule
- Auto-end campaign on permadeath (no LLM involvement required)
- Write a Haiku memorial diary entry on permadeath before ending the campaign
- Emit `CAMPAIGN_ENDED` STATUS chunk to the SSE stream so the frontend reacts
- Force-end the active GameSession when a campaign ends
- Show a full-screen memorial on the frontend; mark ended campaigns read-only on the dashboard

**Non-Goals:**
- Campaign restart or character inheritance mechanics
- Partial-death scenarios (unconscious but not dead in PERMADEATH mode — that is already handled by death save rolls failing 3 times or instant death)
- Retroactive closure of campaigns that ended before this change (they remain ACTIVE; no migration of existing data)
- Multi-character campaigns

## Decisions

### 1. CampaignStatus lives on Campaign, not Session

**Decision:** Add `status: CampaignStatus`, `endedAt: Date | null`, `endReason: string | null` to the `Campaign` entity.

**Rationale:** A session can end for many reasons (player logs off, browser closes). Campaign conclusion is a permanent, irreversible state that belongs to the campaign, not to a transient session. Querying ended campaigns for the dashboard badge is a simple `WHERE status = 'ENDED'` on Campaign.

**Alternative considered:** A `CampaignEnd` join table — rejected because there is exactly one end event per campaign; a nullable column is simpler.

### 2. Permadeath auto-end bypasses the LLM `end_campaign` tool

**Decision:** When `roll_death_save` or `instant_death` sets `isDead = true` and `campaign.deathMode === PERMADEATH`, the game engine service itself calls `endCampaignOnPermadeath()` — it does NOT ask the LLM to call `end_campaign`.

**Rationale:** The LLM could theoretically forget or misfire the tool. Permadeath must be deterministic — the server enforces it. The Haiku memorial write and campaign-end happen synchronously within the death tool handler before the tool result is returned to the DM stream.

**Alternative considered:** Have the DM LLM call `end_campaign` after narrative conclusion — rejected for PERMADEATH (too fragile). Kept for STORY mode where campaign conclusion is intentionally narrative-driven.

### 3. `end_campaign` tool for STORY mode / natural conclusion

**Decision:** Add `end_campaign(campaignId, reason, epitaph)` as an explicit LLM tool in GameEngineModule. The LLM calls it when the story resolves (antagonist defeated, player retires, etc.). Server: marks campaign ENDED, ends session, emits `CAMPAIGN_ENDED`.

**Rationale:** STORY mode resurrection paths and story conclusions are narrative events the LLM controls. Giving the LLM a tool preserves that agency. The `epitaph` parameter lets the LLM craft the closing text.

### 4. Memorial diary entry via existing `DiaryService.writeDiaryEntry`

**Decision:** On permadeath, before ending the campaign, call the existing Haiku-powered `writeDiaryEntry` pipeline with a special `MEMORIAL` entry type (or a `memorial: true` flag). This reuses the same Haiku prompt infrastructure already tested for daily diary writes.

**Rationale:** The diary write pipeline already handles Haiku orchestration, token budgets, and MikroORM persistence. No new LLM invocation infrastructure needed.

**Alternative considered:** A separate `MemorialService` — rejected (YAGNI; the existing pipeline handles it with a parameter).

### 5. `CAMPAIGN_ENDED` as a STATUS-type SSE chunk

**Decision:** Extend `DmStreamChunkType` with `CAMPAIGN_ENDED`. The chunk payload includes `epitaph` (string) and a `stats` object (`daysPlayed`, `questsCompleted`). The frontend listens for this chunk type and transitions to the memorial screen.

**Rationale:** STATUS chunks are already used for non-narrative events (scene transitions, session end). The frontend SSE handler already switches on chunk type. Adding a new type is a minimal, non-breaking extension.

**Stats collection:** `daysPlayed` from `campaign.currentInGameDate - campaign.startDate`; `questsCompleted` from a `Quest` count query at end time — both available without new columns.

### 6. Session force-end on campaign ENDED

**Decision:** `CampaignService.endCampaign()` calls `SessionService.endActiveSession(campaignId)` after persisting the status change.

**Rationale:** An ended campaign must have no active session. Centralising this in `endCampaign()` means both the auto-permadeath path and the `end_campaign` tool path get session teardown for free.

### 7. Frontend: full-screen memorial, read-only dashboard badge

**Decision:**
- `CampaignEndScreen.vue` — full-screen overlay rendered when the SSE stream emits `CAMPAIGN_ENDED`. Shows epitaph, stats, "Start New Campaign" button.
- Dashboard: query includes `status`; ended campaigns render a memorial badge and all action buttons are disabled/removed.

**Rationale:** A full-screen moment gives permadeath the narrative gravity it deserves. Dashboard read-only state prevents accidental session start on a concluded campaign.

## Risks / Trade-offs

- **Haiku memorial write blocks the SSE stream momentarily** → Mitigation: run `writeDiaryEntry` and `endCampaign` sequentially within the tool handler but emit the final `CAMPAIGN_ENDED` chunk only after both succeed. Acceptable latency (<2s) given this is a once-per-campaign event.
- **Race condition: world tick running while permadeath fires** → Mitigation: existing Redis `campaignLocked` lock is already checked before world tick. The permadeath path should acquire the same lock (or abort if locked). If the tick is in-flight, the death save result is returned and the auto-end is deferred until the lock releases — acceptable because the player is already dead.
- **`end_campaign` tool called on an already-ended campaign** → Mitigation: tool handler checks `campaign.status === ENDED` and returns a structured error the LLM can narrate around ("The chronicle of this campaign has already been sealed.").
- **Frontend receives `CAMPAIGN_ENDED` chunk after reconnect** → The SSE stream for an ended campaign session will not exist (session is force-ended). The frontend polling `campaignStatus` on mount handles stale state via a GraphQL query for the campaign's `status` field.

## Migration Plan

1. Add `CampaignStatus` enum to `campaign.enums.ts`
2. Add `status`, `endedAt`, `endReason` columns to `Campaign` entity with defaults (`ACTIVE`, `null`, `null`)
3. Generate and run MikroORM migration — all existing campaigns default to ACTIVE, non-breaking
4. Implement backend changes (tool, death service branching, session teardown, SSE chunk)
5. Implement frontend changes (end screen component, dashboard badge, SSE handler)
6. No rollback concerns: new nullable columns; removing them later is a simple migration

**Rollback:** Revert migration to drop the three columns; revert code. No data loss for active campaigns.

## Open Questions

- Should the `end_campaign` tool be callable by the LLM in PERMADEATH mode too (e.g., the LLM wants to end a campaign for narrative reasons unrelated to death)? Current design: yes — the tool is available in all modes; the permadeath auto-end just means it fires automatically without LLM involvement on `isDead = true`.
- Should ended campaigns be permanently excluded from the main campaigns list query, or surfaced with a filter toggle? Current assumption: always included, distinguished by badge. Revisit if dashboard becomes cluttered.
