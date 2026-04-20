## ADDED Requirements

### Requirement: Campaign records carry a lifecycle status
The system SHALL add a `status` field of type `CampaignStatus` (enum: `ACTIVE` | `ENDED`) to the `Campaign` entity, with a default value of `ACTIVE`. The entity SHALL also store `endedAt: Date | null` and `endReason: string | null`. A MikroORM migration SHALL add these three columns; all existing rows default to `ACTIVE` with null timestamps.

#### Scenario: New campaign defaults to ACTIVE
- **WHEN** a `Campaign` record is created via `createCampaign`
- **THEN** its `status` is `ACTIVE`, `endedAt` is `null`, and `endReason` is `null`

#### Scenario: Ended campaign persists status, timestamp, and reason
- **WHEN** a campaign's status is set to `ENDED`
- **THEN** the system persists `status = ENDED`, a non-null `endedAt` timestamp (UTC), and the provided `endReason` string

#### Scenario: ENDED status is permanent
- **WHEN** a campaign already has `status = ENDED`
- **THEN** any attempt to transition it back to `ACTIVE` is rejected with a structured error

### Requirement: CampaignStatus enum is exposed via GraphQL
The system SHALL expose `status`, `endedAt`, and `endReason` as fields on the `Campaign` GraphQL type so the frontend can read campaign lifecycle state.

#### Scenario: Campaign query returns status fields
- **WHEN** an authenticated owner queries their campaign
- **THEN** the response includes `status`, `endedAt`, and `endReason` fields

#### Scenario: Ended campaign is visible in campaigns list
- **WHEN** the owner queries the campaigns connection
- **THEN** campaigns with `status = ENDED` are included in results alongside active ones
