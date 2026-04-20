## ADDED Requirements

### Requirement: end_campaign LLM tool concludes a campaign
The system SHALL register an `end_campaign` tool in `GameEngineModule` with parameters `campaignId: string`, `reason: string`, and `epitaph: string`. When called, the tool SHALL set `campaign.status = ENDED`, persist `endedAt` and `endReason`, force-end the active `GameSession`, and emit a `CAMPAIGN_ENDED` STATUS chunk into the DM SSE stream. The tool SHALL return a structured success result so the LLM can narrate the conclusion.

#### Scenario: LLM calls end_campaign for story conclusion
- **WHEN** the LLM invokes `end_campaign` with a valid `campaignId`, `reason`, and `epitaph`
- **THEN** the campaign's `status` is set to `ENDED`, `endedAt` is stamped, and `endReason` is persisted

#### Scenario: Active session is terminated on campaign end
- **WHEN** `end_campaign` succeeds
- **THEN** the active `GameSession` for that campaign has its `endedAt` set, preventing further player input

#### Scenario: CAMPAIGN_ENDED chunk is emitted
- **WHEN** `end_campaign` succeeds
- **THEN** a STATUS chunk with type `CAMPAIGN_ENDED`, the `epitaph` string, and a `stats` object (`daysPlayed`, `questsCompleted`) is emitted into the SSE stream before the tool result is returned

#### Scenario: Calling end_campaign on an already-ended campaign returns a structured error
- **WHEN** `end_campaign` is called for a campaign whose `status` is already `ENDED`
- **THEN** the tool returns a structured error result (not an exception) the LLM can acknowledge in narrative

#### Scenario: end_campaign is available in STORY and PERMADEATH modes
- **WHEN** the DM session is active for any campaign regardless of `deathMode`
- **THEN** `end_campaign` appears in the available tool set and can be invoked by the LLM

### Requirement: CAMPAIGN_ENDED is a valid DmStreamChunkType
The system SHALL add `CAMPAIGN_ENDED` to the `DmStreamChunkType` enum. The chunk payload SHALL include `epitaph: string`, `daysPlayed: number`, and `questsCompleted: number`.

#### Scenario: CAMPAIGN_ENDED chunk has required payload fields
- **WHEN** a `CAMPAIGN_ENDED` chunk is constructed
- **THEN** it carries non-null `epitaph`, `daysPlayed`, and `questsCompleted` fields

#### Scenario: Frontend SSE handler recognises CAMPAIGN_ENDED chunk type
- **WHEN** the SSE stream emits a chunk with type `CAMPAIGN_ENDED`
- **THEN** the frontend handler routes it to the campaign-end transition logic
