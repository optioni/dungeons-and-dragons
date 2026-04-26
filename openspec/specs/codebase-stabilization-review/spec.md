# Codebase Stabilization Review

## Purpose

TBD — Defines the process and artifact format for conducting a stabilization review before starting the next major feature wave. The review audits baseline verification, critical user journeys, spec/code alignment, architecture risks, and test coverage gaps.

## Requirements

### Requirement: Stabilization Review Artifact

The project SHALL maintain a stabilization review artifact that records baseline verification results, critical user journey traces, spec/code alignment findings, architecture risks, and test coverage gaps before starting the next major feature wave.

#### Scenario: Review starts after core features are implemented

- **GIVEN** most implementation changes have been archived into main OpenSpec specs
- **WHEN** the stabilization review begins
- **THEN** the review artifact captures the intended audit scope and finding format
- **AND** the review does not require application code changes before findings are triaged

### Requirement: Findings Classification

The stabilization review SHALL classify each finding by severity and follow-up type.

#### Scenario: Reviewer records a finding

- **GIVEN** the reviewer finds a code, spec, verification, or usability issue
- **WHEN** the finding is added to the review artifact
- **THEN** it includes severity, area, evidence, impact, and suggested action
- **AND** the suggested action is one of quick fix, new OpenSpec change, defer, or no action

### Requirement: Read-only First Pass

The stabilization review SHALL keep the initial audit pass separate from implementation work.

#### Scenario: Review uncovers a likely bug

- **GIVEN** the reviewer identifies a likely correctness issue
- **WHEN** the initial read-only audit pass is still in progress
- **THEN** the reviewer records evidence and impact in the review artifact
- **AND** the implementation fix is deferred until triage unless the user explicitly asks to exit review mode
