## ADDED Requirements

### Requirement: trigger_spell_prep initiates prepared-spell selection flows
The system SHALL expose a `trigger_spell_prep` LLM tool that accepts `characterId`. The tool SHALL validate that the addressed character belongs to a spell-preparing class with an active campaign session, and it SHALL trigger the spell-preparation UI flow before the player submits prepared spells.

#### Scenario: Valid prepared caster triggers spell-preparation flow
- **WHEN** the LLM calls `trigger_spell_prep` for a Wizard, Cleric, or Druid with an active session
- **THEN** the tool returns a structured success result and the runtime emits the `SPELL_PREP_PENDING` pause signal for that session

#### Scenario: Non-prepared casters are rejected gracefully
- **WHEN** the LLM calls `trigger_spell_prep` for a character whose class does not use prepared spells
- **THEN** the tool returns a structured error result and no pause signal is emitted

