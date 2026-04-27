## ADDED Requirements

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
