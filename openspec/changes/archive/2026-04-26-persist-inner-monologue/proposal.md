## Why

The inner monologue is generated after each eligible DM turn and streamed to the frontend, but never persisted — a page reload loses it. Storing the latest monologue on `GameSession` lets the frontend restore it on load with no extra query.

## What Changes

- Add a nullable `lastInnerVoice` text column to `GameSession`
- `InnerMonologueService` writes the generated text to `session.lastInnerVoice` after publishing the SSE stream
- `SessionService.sendPlayerInput` clears `lastInnerVoice = null` before processing the new turn
- `lastInnerVoice` is exposed on the `GameSession` GraphQL type
- Frontend seeds `innerVoiceText` from `activeSession.lastInnerVoice` on page load

## Capabilities

### New Capabilities

_(none — this is an extension of an existing capability)_

### Modified Capabilities

- `character-inner-monologue`: Add requirement that the generated monologue is persisted to `GameSession.lastInnerVoice` after streaming, cleared when the player sends their next input, and restored from the session on page load
- `game-session`: Add `lastInnerVoice` (nullable text, default null) as a recognised field on `GameSession`

## Impact

- **API**: `GameSession` entity and GraphQL type gain `lastInnerVoice` field; `InnerMonologueService` needs an ORM flush after generation; `SessionService` clears the field on player input
- **Database**: one new nullable text column + migration
- **Frontend**: `play.vue` reads `lastInnerVoice` from `activeSession` to seed `innerVoiceText` on mount; no change to streaming path
- **Tests**: unit tests for `InnerMonologueService` (persists after generation) and `SessionService` (clears on input)
