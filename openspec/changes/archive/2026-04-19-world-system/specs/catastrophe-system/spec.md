## ADDED Requirements

### Requirement: Catastrophe roll runs after outcome application each tick
The system SHALL make a single Haiku call after the atomic outcome flush in each world tick to evaluate whether a catastrophic world event should occur. The Haiku prompt SHALL include the current campaign state, recent `WorldEvent` rows, and a framing instruction that sets the probability of a catastrophe at approximately 5%. The model SHALL decide whether to invoke `trigger_catastrophe` based on this framing.

#### Scenario: Catastrophe roll runs every tick
- **WHEN** a world tick completes its agenda and conversation steps
- **THEN** a catastrophe Haiku call is made regardless of whether any agenda or conversation outcomes were produced

#### Scenario: Catastrophe does not occur on most ticks
- **WHEN** the catastrophe Haiku call runs
- **THEN** the model invokes `trigger_catastrophe` approximately 5% of the time, leaving most ticks without a catastrophic event

### Requirement: trigger_catastrophe tool creates a CATASTROPHE-sourced WorldEvent
The system SHALL expose a `trigger_catastrophe` tool available only during the world tick Haiku call (not during DM session). When invoked, the tool SHALL create a `WorldEvent` row with `source: CATASTROPHE`, `status: ACTIVE`, a Haiku-generated `description` of the catastrophic event, and an optional `locationId` if the catastrophe is geographically anchored. The tool SHALL return a structured success result.

#### Scenario: Invoked tool creates a WorldEvent with CATASTROPHE source
- **WHEN** Haiku invokes `trigger_catastrophe` during a world tick
- **THEN** a `WorldEvent` row is persisted with `source = CATASTROPHE`, `status = ACTIVE`, and a non-empty `description`

#### Scenario: Catastrophe can be location-scoped
- **WHEN** Haiku invokes `trigger_catastrophe` with a `locationId`
- **THEN** the created `WorldEvent` has `locationId` set to that location

#### Scenario: Catastrophe can be campaign-wide
- **WHEN** Haiku invokes `trigger_catastrophe` without a `locationId`
- **THEN** the created `WorldEvent` has `locationId = null`, representing a campaign-wide catastrophe

#### Scenario: trigger_catastrophe is not available during DM session
- **WHEN** the DM session Sonnet call processes player input
- **THEN** `trigger_catastrophe` is not included in the available tool list

### Requirement: Catastrophe events are discoverable in the worldEvents query
The system SHALL make `CATASTROPHE`-sourced `WorldEvent` rows available via the existing owner-scoped `worldEvents` relay query. The DM session context loader SHALL include active `CATASTROPHE` events when assembling world state for the LLM prompt so the DM can surface them narratively.

#### Scenario: Player can query catastrophe events
- **WHEN** the owner queries `worldEvents` for their campaign
- **THEN** `WorldEvent` rows with `source = CATASTROPHE` and `status = ACTIVE` are included in the results

#### Scenario: Catastrophe event appears in DM session world context
- **WHEN** the context loader assembles world state for a DM session
- **THEN** active `CATASTROPHE` world events are included so the DM can reference them in narrative
