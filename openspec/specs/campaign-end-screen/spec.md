# Campaign End Screen Spec

## Purpose

Defines the full-screen memorial component rendered when a campaign concludes. The end screen displays the campaign epitaph, final statistics, and provides navigation to campaign creation for the next adventure.

## Requirements

### Requirement: CampaignEndScreen component renders on CAMPAIGN_ENDED chunk
The web app SHALL render a full-screen `CampaignEndScreen` component when the active SSE stream emits a `CAMPAIGN_ENDED` STATUS chunk during a game session. The screen SHALL replace the play view and SHALL display the epitaph text, final campaign stats (`daysPlayed`, `questsCompleted`), and a "Start New Campaign" button.

#### Scenario: Full-screen memorial appears on CAMPAIGN_ENDED
- **WHEN** the SSE subscription handler receives a `CAMPAIGN_ENDED` chunk
- **THEN** the `CampaignEndScreen` component is rendered, replacing the play view in the viewport

#### Scenario: Epitaph text is displayed prominently
- **WHEN** the `CampaignEndScreen` is rendered
- **THEN** the `epitaph` string from the chunk payload is displayed as the primary narrative text

#### Scenario: Campaign stats are displayed
- **WHEN** the `CampaignEndScreen` is rendered
- **THEN** `daysPlayed` and `questsCompleted` values from the chunk payload are shown as summary statistics

#### Scenario: Start New Campaign button navigates away
- **WHEN** the user clicks "Start New Campaign" on the `CampaignEndScreen`
- **THEN** the app navigates to the new-campaign creation flow

### Requirement: CampaignEndScreen is shown on mount if campaign is already ENDED
The play route SHALL query the campaign's `status` field on mount. If the campaign is already `ENDED` (e.g., after a page refresh), the route SHALL display the `CampaignEndScreen` immediately without requiring an SSE stream event.

#### Scenario: Refreshing after campaign end shows memorial screen
- **WHEN** the player navigates to a campaign whose `status` is `ENDED`
- **THEN** the `CampaignEndScreen` is displayed without attempting to start or resume an SSE stream

#### Scenario: Player input is not available on ended campaign
- **WHEN** the `CampaignEndScreen` is shown
- **THEN** no player input field or session controls are rendered
