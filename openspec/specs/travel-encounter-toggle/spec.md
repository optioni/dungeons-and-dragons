# Travel Encounter Toggle Spec

## Purpose

Defines how the campaign stores encounter settings and how the LLM can toggle encounter behaviour via a configuration tool.

## Requirements

### Requirement: Campaign stores a travelEncounterEnabled flag
The `Campaign` entity SHALL have a `travelEncounterEnabled: boolean` field with a default value of `true`. A MikroORM migration SHALL add the column as `NOT NULL DEFAULT true`. When `false`, encounter rolls after `travel_to` are skipped entirely.

#### Scenario: New campaigns default to encounters enabled
- **WHEN** a new `Campaign` is created
- **THEN** `travelEncounterEnabled` is `true`

#### Scenario: Flag persists across sessions
- **WHEN** `travelEncounterEnabled` is set to `false` and the session is reloaded
- **THEN** the value remains `false`

### Requirement: update_campaign_settings tool lets the LLM toggle encounter behaviour
The system SHALL expose an `update_campaign_settings` tool that accepts `campaignId` and a partial settings object `{ travelEncounterEnabled?: boolean }`. The tool SHALL update only the provided fields on the `Campaign` entity and return the updated settings. The tool is designed to be extensible for future campaign-level flags.

#### Scenario: LLM disables encounters via update_campaign_settings
- **WHEN** the LLM calls `update_campaign_settings` with `{ travelEncounterEnabled: false }`
- **THEN** `Campaign.travelEncounterEnabled` is set to `false` and subsequent `travel_to` calls skip encounter rolls

#### Scenario: LLM re-enables encounters
- **WHEN** `Campaign.travelEncounterEnabled` is `false` and the LLM calls `update_campaign_settings` with `{ travelEncounterEnabled: true }`
- **THEN** `Campaign.travelEncounterEnabled` is set to `true` and encounter rolls resume on the next `travel_to`

#### Scenario: Omitting a flag leaves it unchanged
- **WHEN** the LLM calls `update_campaign_settings` with an empty object `{}`
- **THEN** no campaign fields are modified and the tool returns the current settings unchanged
