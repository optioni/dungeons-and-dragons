# Quest UI

## Purpose

Defines the frontend UI and UX for displaying quests to the player. This spec covers the quests page, quest card components, objective checklists, completed quest display, and navigation integration.

## Requirements

### Requirement: Quests page displays active and completed quests for a campaign
The system SHALL provide a quests page at `/campaign/[id]/quests` that:
- Queries `quests(campaignId, status: ACTIVE)` and `quests(campaignId, status: COMPLETED | FAILED)` via urql
- Renders active quests in a primary section and completed/failed quests in a secondary section
- Uses Nuxt UI v4 components for layout and styling

#### Scenario: Active quests are shown in their own section
- **WHEN** a user navigates to `/campaign/[id]/quests`
- **THEN** the page renders a section titled "Active Quests" containing all quests with status ACTIVE

#### Scenario: Completed and failed quests are shown in a separate section
- **WHEN** the page loads
- **THEN** completed and failed quests are rendered in a collapsible or secondary "Completed" section below active quests

#### Scenario: Empty state is shown when there are no active quests
- **WHEN** a campaign has no active quests
- **THEN** the "Active Quests" section shows a descriptive empty-state message

### Requirement: Each quest card shows title, description, and objective checklist
The system SHALL render each quest as a card containing:
- Quest `title` and `description`
- An ordered objective checklist showing `QuestObjective.description` for each objective
- A visual indicator (checkbox or icon) for each objective's `status` (INCOMPLETE vs COMPLETE)
- Quest rewards (`rewardNarrative`, `rewardXp`, `rewardGold`) when present, displayed on completed quests

#### Scenario: Objective checklist reflects current completion state
- **WHEN** a quest has two COMPLETE and one INCOMPLETE objective
- **THEN** the card shows two checked items and one unchecked item in order

#### Scenario: Completed quest card shows reward information
- **WHEN** a quest has status COMPLETED and non-null reward fields
- **THEN** the card displays the reward narrative and numeric rewards (XP and gold if present)

### Requirement: Quests page is accessible from campaign navigation
The system SHALL include a link to the quests page (`/campaign/[id]/quests`) in the campaign's navigation sidebar or tab bar alongside other campaign views.

#### Scenario: Quests link appears in campaign navigation
- **WHEN** a user is viewing any page under `/campaign/[id]/`
- **THEN** a "Quests" navigation item is present and links to `/campaign/[id]/quests`

#### Scenario: Quests link is active on the quests page
- **WHEN** the user is on `/campaign/[id]/quests`
- **THEN** the "Quests" navigation item is visually highlighted as active

### Requirement: Quest visible events surface quest progress during play
The play UI SHALL surface `PLAYER_VISIBLE_EVENT` records with category `QUEST` as player-facing quest progress annotations and SHALL keep quest page state refreshable from durable quest data. Quest visible events SHALL summarize quest creation, objective updates, quest completion, and quest failure without exposing hidden objective logic or raw tool payloads.

#### Scenario: Quest objective update appears during play
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `QUEST` and kind `QUEST_OBJECTIVE_UPDATED` is reconciled after a turn
- **THEN** the play UI shows a compact quest progress annotation with the visible quest or objective summary

#### Scenario: Quest completion appears during play
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `QUEST` and kind `QUEST_COMPLETED` is reconciled after a turn
- **THEN** the play UI shows a compact completion annotation and the quests page can reflect the updated completed status from durable quest data

#### Scenario: Hidden quest logic is not exposed
- **WHEN** a quest auto-check or tool result updates hidden quest state not yet visible to the player
- **THEN** no quest visible event exposes hidden conditions, hidden entity links, or raw checker logic
