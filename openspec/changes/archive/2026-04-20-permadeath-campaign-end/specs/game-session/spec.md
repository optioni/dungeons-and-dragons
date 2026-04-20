## MODIFIED Requirements

### Requirement: Sessions can be ended explicitly
The system SHALL expose an `endSession` mutation for the owner of an active session. Ending a session SHALL set `endedAt` on that session and SHALL prevent further player input from being accepted for it. Additionally, `SessionService` SHALL expose an internal `endActiveSession(campaignId)` method callable by `CampaignService` when a campaign transitions to `ENDED` status — this path does not require a GraphQL mutation call.

#### Scenario: Owner ends an active session
- **WHEN** the owner calls `endSession` for their active `GameSession`
- **THEN** the system sets `endedAt` and returns the session as ended

#### Scenario: Ended session is not considered active
- **WHEN** the owner queries the active session for a campaign after calling `endSession`
- **THEN** the ended session is not returned as the campaign's active session

#### Scenario: Campaign end force-terminates the active session
- **WHEN** `CampaignService.endCampaign()` is called for a campaign with an active session
- **THEN** `SessionService.endActiveSession(campaignId)` sets `endedAt` on that session without requiring user interaction

#### Scenario: Ended campaign session rejects player input
- **WHEN** the owner submits player input for a session that was force-ended via campaign closure
- **THEN** the mutation returns an error indicating the session is no longer active
