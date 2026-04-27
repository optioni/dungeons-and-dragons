## ADDED Requirements

### Requirement: Transcript renders non-combat visible mechanical milestones
The play transcript SHALL render non-combat `PLAYER_VISIBLE_EVENT` records as restrained marginal annotations when their category is `INVENTORY`, `QUEST`, `DISCOVERY`, `TRAVEL`, or non-combat `RESOURCE`. The annotation SHALL display the event title and optional summary without exposing raw tool payloads.

#### Scenario: Inventory event renders as marginal annotation
- **WHEN** the transcript contains a `PLAYER_VISIBLE_EVENT` with category `INVENTORY` and kind `ITEM_GAINED`
- **THEN** the transcript renders a compact annotation showing the item gain title or summary in chronological order

#### Scenario: Quest event renders as marginal annotation
- **WHEN** the transcript contains a `PLAYER_VISIBLE_EVENT` with category `QUEST`
- **THEN** the transcript renders a compact quest annotation without requiring the player to open the quests page

#### Scenario: Hidden payload fields are not displayed
- **WHEN** a `PLAYER_VISIBLE_EVENT` is rendered in the transcript
- **THEN** the UI displays only the normalized title, summary, entities, and values intended for player display

### Requirement: Visible event annotations follow the Dark Grimoire transcript treatment
The play UI SHALL style non-combat visible event annotations as Dark Grimoire marginalia. The treatment SHALL use a subtle left border, Cinzel uppercase micro-labels, IM Fell English summary text, mono text only for numeric values, and the existing grimoire palette. It SHALL NOT use toast styling, bright success or error colors, box shadows, or large card containers.

#### Scenario: Annotation uses marginalia styling
- **WHEN** a non-combat visible event annotation is rendered
- **THEN** it appears as an inline transcript annotation with grimoire border, typography, and color treatment consistent with dice roll cards

### Requirement: Turn reconciliation includes persisted visible events
The play route SHALL reconcile newly persisted `PLAYER_VISIBLE_EVENT` rows through the normal end-of-turn event history path. Non-blocking visible events SHALL NOT require one live stream chunk per event.

#### Scenario: Visible event appears after turn completion
- **WHEN** a DM turn persists a visible mechanical event and then completes
- **THEN** the play route includes that event in the transcript after end-of-turn reconciliation

#### Scenario: Visible events do not interrupt streaming prose
- **WHEN** a visible mechanical event is persisted during a streaming DM turn
- **THEN** the UI does not insert a separate live annotation mid-sentence unless another explicit stream signal requires immediate UI reaction
