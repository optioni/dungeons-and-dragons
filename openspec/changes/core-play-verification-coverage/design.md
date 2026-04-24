# Core Play Verification Coverage Design

## Purpose

Add focused verification for the player-facing path that was under-covered during the stabilization review. The goal is to catch regressions in navigation, route loading, stream state handling, and state inspection without turning this change into a gameplay feature.

## Scope

In scope:

- Dashboard ready-campaign Play navigation.
- Setup completion navigation into play.
- Character sheet and quests page rendering for loaded campaign data.
- World overview diary cursor pagination behavior.
- Play route session start/resume, transcript finalization, blocking overlays, and basic responsive shell assumptions.
- A deterministic smoke check for the core play loop using mocked or fake LLM transport.

Out of scope:

- New gameplay mechanics.
- New GraphQL schema fields unless implementation proves a test seam is missing.
- Live paid LLM calls in routine automated tests.
- Broad visual snapshot coverage.

## Verification Strategy

Use the narrowest reliable layer for each risk:

| Risk | Preferred Verification |
| --- | --- |
| Ready campaign cannot enter play | Vue page test for dashboard click target plus setup completion CTA |
| Inspectable state pages regress | Vue page tests with mocked urql query responses |
| Diary older entries cannot load | World page test that asserts `after` cursor is used and entries append |
| Stream chunks duplicate or stale shell state | Existing play tests plus targeted additions for session start/resume |
| Core loop cannot be smoke checked | Fake Anthropic/tool transport or documented script that avoids live Claude by default |

## Smoke Harness Decision

The automated path should prefer a fake Anthropic transport over a live model. A live Claude smoke script may be useful for manual release checks, but it must stay opt-in and must not run in normal unit/integration commands.

If a fake transport requires invasive refactoring, stop after adding the web route/page coverage and document the smallest follow-up test seam needed.
