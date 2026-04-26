## Why

The stabilization review found that the product is not ready to play because the normal ready-campaign navigation does not enter the play route, and several core web journeys lack page-level regression coverage. The review also found that the live play loop is mostly covered through unit and mocked stream tests, but there is no deterministic smoke check that exercises the player-facing path as a whole.

This change adds verification coverage for the core play path before the next feature wave, without expanding gameplay behavior.

## What Changes

- Add route/page tests for dashboard ready Play navigation and setup completion navigation into `/campaign/:id/play`.
- Add page-level web coverage for character sheet, quests, world diary pagination, and the play shell's core responsive states.
- Add a deterministic play-loop smoke harness or documented manual smoke script that can verify campaign setup, session start/resume, player input, stream completion, and inspectable state without requiring a live Claude call.

## Capabilities

### New Capabilities

- `core-play-verification-coverage`: Verification coverage for the core player path, smoke checks, and critical web navigation.

### Modified Capabilities

None. This is a verification-only change; behavior fixes identified by the stabilization review remain quick maintenance work unless the implementation reveals a design decision.

## Impact

- Web tests under `apps/web/tests`.
- API or test-support code only if needed for a deterministic fake Anthropic smoke harness.
- Documentation or script for manual smoke verification if a fully automated smoke test is not practical.
- No database migrations expected.
