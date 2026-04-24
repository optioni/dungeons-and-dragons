## Why

Most core gameplay, API, web, and infrastructure changes have been implemented and archived into main OpenSpec specs. Before starting another feature wave, the project needs a stabilization review that checks whether the codebase, specs, and verification suite still agree.

This change is intentionally read-only at first. It creates a structured audit so findings can be ranked before deciding whether each item should become a quick maintenance fix, a new OpenSpec change, or deferred cleanup.

## What Changes

- Add a stabilization review artifact that tracks baseline verification, critical user journeys, spec/code alignment, architecture risks, web/API completeness, and test coverage.
- Classify findings by severity and by follow-up type.
- Keep the first pass focused on evidence gathering. Application code changes should happen after findings are triaged.

## Capabilities

### New Capabilities

- `codebase-stabilization-review`: A read-only audit process for validating implemented behavior against OpenSpec specs, runtime flows, and verification commands.

### Modified Capabilities

None yet. Any behavioral or requirement changes discovered during review should become separate OpenSpec changes or explicit spec updates.

## Impact

- OpenSpec only: adds review artifacts under `openspec/changes/codebase-stabilization-review/`.
- No runtime behavior changes.
- No database migrations.
- No frontend or backend code changes during the initial audit pass.
