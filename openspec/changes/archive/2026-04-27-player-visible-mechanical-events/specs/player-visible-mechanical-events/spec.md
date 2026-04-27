## ADDED Requirements

### Requirement: Player-visible mechanical events use a curated normalized payload
The system SHALL define a durable player-visible mechanical event payload for mechanical consequences the player is allowed to know. The payload SHALL include `category`, `kind`, `title`, and optional `summary`, `entities`, and `values` fields. The allowed `category` values SHALL include `COMBAT`, `INVENTORY`, `QUEST`, `DISCOVERY`, `TRAVEL`, and `RESOURCE`. The payload SHALL be an authored player-facing summary, not a raw tool input or raw tool result envelope.

#### Scenario: Visible event payload contains renderer-safe fields
- **WHEN** a successful tool result is mapped into a player-visible mechanical event
- **THEN** the persisted payload includes a category, kind, title, and only player-safe summary, entity, or value fields needed by the UI

#### Scenario: Raw tool payload is not copied
- **WHEN** a player-visible mechanical event is persisted
- **THEN** its content does not include the raw tool input object or raw tool result envelope

### Requirement: Visible event mapping only emits witnessed player consequences
The system SHALL map only successful tool outcomes that represent consequences the character directly experiences or observes. Failed tool calls, internal context operations, background memory operations, unrevealed NPC agenda changes, unrevealed faction changes, and hidden world simulation outcomes SHALL NOT produce player-visible mechanical events.

#### Scenario: Successful player-relevant tool emits visible event
- **WHEN** a successful tool result applies visible damage, grants an item, updates a quest, discovers a location, completes travel, or spends a player resource
- **THEN** the runtime persists a corresponding player-visible mechanical event for the active session

#### Scenario: Hidden or internal tool emits no visible event
- **WHEN** a memory, search, lore bookkeeping, hidden faction, hidden agenda, or unrevealed world event tool succeeds
- **THEN** the runtime does not persist a player-visible mechanical event for that tool result

#### Scenario: Failed tool emits no visible event
- **WHEN** a tool returns a structured failure result
- **THEN** the runtime does not persist a player-visible mechanical event for that failed result

### Requirement: Visible events never leak hidden game state
The system SHALL exclude hidden DCs, hidden enemy statistics, undiscovered location details, unrevealed NPC agenda data, hidden faction disposition values, memory search text, retrieved memories, raw prompts, and raw model content from player-visible mechanical event payloads.

#### Scenario: Undiscovered location details remain hidden
- **WHEN** a tool result references an undiscovered location that the player has not learned about
- **THEN** no player-visible mechanical event exposes that location's name, description, current state, NPCs, or world events

#### Scenario: Hidden enemy stats remain hidden
- **WHEN** a combat tool result involves an enemy with hidden stats
- **THEN** the visible event may summarize observed damage or condition changes but does not expose hidden AC, passive scores, DCs, or full stat blocks

### Requirement: Visible events use a curated default visibility level
The system SHALL expose one curated player-visible mechanical event set. The player SHALL NOT need to configure a verbosity level to receive the default visible mechanical feedback.

#### Scenario: Default visibility requires no setting
- **WHEN** the player uses the play route
- **THEN** eligible player-visible mechanical events are shown according to the curated defaults without requiring a user preference
