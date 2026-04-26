## MODIFIED Requirements

### Requirement: The play route loads or resumes campaign play state
The web application SHALL provide a main gameplay route at `/campaign/[id]/play`. On load, the route SHALL fetch the owned campaign, resolve or create the active `GameSession`, and load the most recent page of persisted transcript events (last 60) before attaching to the live DM stream. The route SHALL NOT load all historical events on mount.

#### Scenario: Play route resumes an existing active session
- **WHEN** the player opens `/campaign/[id]/play` for a campaign that already has an active session
- **THEN** the page loads the most recent 60 `GameEvent`s for that session and subscribes to its `dmStream`

#### Scenario: Play route starts the first session
- **WHEN** the player opens `/campaign/[id]/play` for a ready-to-play campaign with no active session
- **THEN** the UI starts or prompts to start a session and renders the initial opening narrative returned from `startSession`

### Requirement: The transcript combines persisted history with live streamed output
The play UI SHALL render the conversation transcript from persisted `GameEvent`s and append in-progress DM output from `dmStream(sessionId)` without waiting for page reload. Once a streamed DM turn is finalized, the UI SHALL replace the in-progress message by refetching the latest page of events (`last: 60`, no cursor), which resets `persistedEvents` to the current window. When the stream emits `INNER_VOICE` chunks, the play route SHALL render them as a visually distinct, character-owned transcript treatment separate from the DM narrative buffer. The route SHALL treat repeated terminal `DONE` chunks as idempotent once the session is already idle.

#### Scenario: Historical transcript is visible on page load
- **WHEN** the player opens a play route with existing session history
- **THEN** the transcript renders the most recent persisted narrative and player-input events in chronological order

#### Scenario: Live DM output appears while streaming
- **WHEN** the subscription receives `NARRATIVE_CHUNK` payloads for the active session
- **THEN** the UI appends those chunks to the current in-progress DM message in the narrative column

#### Scenario: Finalized DM message replaces optimistic stream state
- **WHEN** the active turn emits its completion signal and the transcript is refetched
- **THEN** the UI replaces the temporary in-progress rendering with the finalized persisted events without duplicating the content

#### Scenario: Inner voice renders as a distinct transcript layer
- **WHEN** the subscription emits `INNER_VOICE` chunks after the main DM turn completes
- **THEN** the UI renders that text in a separate inner-voice treatment without merging it into the active DM narrative bubble

#### Scenario: Second DONE does not reset the transcript a second time
- **WHEN** the subscription emits a second terminal `DONE` chunk after the route is already idle
- **THEN** the UI ignores it without duplicating transcript state or reopening loading indicators

## ADDED Requirements

### Requirement: Transcript supports loading earlier history on demand
The play route SHALL allow the player to load events older than the currently displayed window. The route SHALL observe a sentinel element at the top of the transcript scroll area using an `IntersectionObserver`. When the sentinel becomes visible and `pageInfo.hasPreviousPage` is true, the route SHALL fetch the next older page using the earliest loaded cursor as the `before` argument and prepend those events to the visible transcript. While the earlier events are being prepended, the scroll position SHALL be anchored so the viewport does not jump.

#### Scenario: Load-earlier is triggered when scrolling to the top
- **WHEN** the player scrolls to the top of the transcript and `hasPreviousPage` is true
- **THEN** the route fetches the previous page of events and prepends them to the transcript

#### Scenario: Scroll position is preserved when prepending events
- **WHEN** older events are prepended to the transcript
- **THEN** the scroll container offset adjusts so the previously visible content remains in view

#### Scenario: Load-earlier does not trigger when all events are loaded
- **WHEN** `hasPreviousPage` is false and the player scrolls to the top
- **THEN** no additional fetch is made and no loading indicator is shown

#### Scenario: Load-earlier does not trigger while a fetch is already in progress
- **WHEN** the route is already fetching an earlier page
- **THEN** the intersection observer does not trigger a second concurrent fetch
