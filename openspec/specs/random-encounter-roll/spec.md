# Random Encounter Roll Spec

## Purpose

Defines the mechanics for rolling random encounters after travel. The system determines whether an encounter occurs based on a d20 roll modified by the destination location's danger level.

## Requirements

### Requirement: Post-travel encounter roll determines whether a random encounter occurs
After a successful `travel_to` move, the system SHALL roll 1d20 and add a danger modifier derived from the destination `Location.currentState`. The modifier values are: `SAFE=+0`, `TENSE=+2`, `THREATENED=+4`, `HOSTILE=+6`, `RUINED=+3`. If the total is ≥ 15 AND `Campaign.travelEncounterEnabled` is `true`, an encounter is triggered. The encounter result SHALL be included in the `travel_to` tool result so the LLM can narrate the outcome.

#### Scenario: Roll below threshold produces no encounter
- **WHEN** `travel_to` succeeds and the d20 + danger modifier totals < 15
- **THEN** no encounter is triggered and the tool result contains `encounter: null`

#### Scenario: Roll meets threshold in a SAFE location triggers encounter
- **WHEN** the destination `currentState` is `SAFE` (modifier +0) and the d20 roll is exactly 15
- **THEN** an encounter is triggered

#### Scenario: Roll meets threshold in a HOSTILE location triggers encounter at lower natural roll
- **WHEN** the destination `currentState` is `HOSTILE` (modifier +6) and the d20 roll is 9 (total 15)
- **THEN** an encounter is triggered

#### Scenario: Encounters suppressed when travelEncounterEnabled is false
- **WHEN** `Campaign.travelEncounterEnabled` is `false` and the roll would otherwise trigger an encounter
- **THEN** no encounter is triggered and the tool result contains `encounter: null`
