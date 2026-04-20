## Why

Character death is real and can happen at any moment, and `deathMode` on `Campaign` determines the consequence — but nothing enforces the PERMADEATH path. When `isDead` becomes true in PERMADEATH mode the session continues, no memorial is written, and no campaign-end state exists. The whole arc described in the design spec (memorial diary entry, campaign closure, narrative consequence for STORY mode) is unimplemented.

## What Changes

- `Campaign` gains `status: CampaignStatus` (ACTIVE | ENDED) with `endedAt` timestamp and `endReason` text.
- `end_campaign(campaignId, reason, epitaph)` tool added to the game engine — called by the LLM when the campaign reaches a natural conclusion (permadeath, story resolution, player retirement). Marks campaign ENDED, ends the active session, emits a `CAMPAIGN_ENDED` STATUS chunk.
- **PERMADEATH flow**: after `roll_death_save` or `instant_death` sets `isDead = true`, the game engine checks `campaign.deathMode`. If PERMADEATH, it immediately calls Haiku to write a memorial diary entry (similar to the daily diary write), then sets `campaign.status = ENDED`, emits `CAMPAIGN_ENDED` STATUS chunk with the epitaph.
- **STORY mode flow**: after death, the LLM narrates a resurrection path. When story concludes naturally (antagonist defeated, player retires), the LLM calls `end_campaign` explicitly.
- Frontend handles `CAMPAIGN_ENDED` STATUS chunk: show a full-screen memorial/end-state screen with the epitaph text, final campaign stats (days survived, quests completed), and a "Start New Campaign" button.
- Dashboard (`/`) marks ended campaigns with a memorial badge; they are read-only.

## Capabilities

### New Capabilities
- `campaign-status`: `CampaignStatus` enum (ACTIVE | ENDED) on Campaign with `endedAt` and `endReason`.
- `campaign-end-tool`: `end_campaign` LLM tool — concludes the campaign, ends the session, emits CAMPAIGN_ENDED.
- `permadeath-auto-end`: Death in PERMADEATH mode automatically triggers memorial diary write + campaign end without LLM needing to call `end_campaign`.
- `campaign-end-screen`: Frontend full-screen memorial with epitaph, stats, and new-campaign CTA.

### Modified Capabilities
- `game-engine`: Death resolution (`roll_death_save`, `instant_death`) checks `deathMode` and branches to permadeath end or STORY continuation.
- `game-session`: Session is forcibly ended when campaign status becomes ENDED.
- `memory-system`: Memorial diary entry written by Haiku on permadeath (same pipeline as daily diary).
- `web-dashboard`: Ended campaigns shown with memorial badge, read-only.

## Impact

- `Campaign` entity — add `status`, `endedAt`, `endReason`; MikroORM migration required
- `CampaignStatus` enum added to `campaign.enums.ts`
- `GameEngineModule` — new `end_campaign` tool; death services check `deathMode` post-resolution
- `DmStreamChunk` — `CAMPAIGN_ENDED` added to `DmStreamChunkType`
- `MemoryModule` — `writeDiaryEntry` called from game engine on permadeath (already exists, new call site)
- `SessionModule` — session end triggered on campaign status change
- Frontend — new `CampaignEndScreen` component; dashboard badge
- Depends on `game-engine`, `session-and-llm`, `memory-system`
