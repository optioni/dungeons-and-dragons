# NPC Conversations

## Purpose

Defines how co-located NPCs with established relationships engage in structured conversations during world ticks, how conversation outcomes affect relationships and inventory, and how these changes integrate with the atomic outcome application model.

## Requirements

### Requirement: Co-located NPC pairs with relationships are identified for conversation
After the agenda step, the system SHALL query for `NpcRelationship` rows where both `sourceNpcId` and `targetNpcId` share the same `currentLocationId` within the campaign. Each qualifying pair is a conversation candidate. Pairs SHALL be prioritised by relationship type: ENEMY and RIVAL first, then ALLY, MENTOR, STUDENT, FAMILY, then NEUTRAL. Recency of last conversation SHALL be used as a tiebreaker (pairs that conversed least recently go first). Each NPC SHALL participate in at most one conversation per tick.

#### Scenario: Co-located related NPCs are paired for conversation
- **WHEN** NPC A and NPC B share `currentLocationId` and a `NpcRelationship` row exists between them
- **THEN** they are included as a candidate conversation pair for that tick

#### Scenario: NPCs at different locations are not paired
- **WHEN** NPC A is at location 1 and NPC B is at location 2 and a relationship exists between them
- **THEN** they are not included as a conversation pair for that tick

#### Scenario: ENEMY pairs are prioritised over ALLY pairs
- **WHEN** both an ENEMY pair and an ALLY pair are eligible in the same tick
- **THEN** the ENEMY pair is scheduled for conversation first

#### Scenario: Each NPC converses at most once per tick
- **WHEN** NPC A has qualifying relationships with both NPC B and NPC C
- **THEN** NPC A participates in at most one conversation and the other pair is deferred to a future tick

### Requirement: NPC conversations run as a structured 2-turn Haiku dialogue
The system SHALL run each conversation pair as a 2-turn Haiku call: NPC A speaks first, NPC B responds. The Haiku prompt SHALL include both NPCs' names, personalities, speech styles, dispositions, relationship type and description, and current location context. The conversation SHALL be capped at exactly 2 turns — no additional back-and-forth.

#### Scenario: Conversation produces two dialogue turns
- **WHEN** Haiku processes a conversation pair
- **THEN** the response contains exactly two dialogue turns: one from the source NPC and one from the target NPC

#### Scenario: Haiku receives full NPC context
- **WHEN** a conversation Haiku call is made
- **THEN** the prompt includes personality traits, speech style, disposition, and relationship description for both NPCs

### Requirement: Conversation outcomes update NPC and relationship state
The system SHALL extract a structured outcome from each conversation: optional `relationshipChange` (new `NpcRelationshipType` and updated `description`), optional `itemExchanged` (NpcItem transfer between the two NPCs), and optional `newAgenda` for either NPC. These outcomes SHALL be collected and applied atomically with all other tick outcomes in the single end-of-tick flush.

#### Scenario: Hostile conversation can worsen a relationship
- **WHEN** an ENEMY pair's conversation produces a `relationshipChange`
- **THEN** the `NpcRelationship.type` and `description` are updated to reflect the new dynamic

#### Scenario: Friendly conversation can result in item exchange
- **WHEN** an ALLY pair's conversation produces an `itemExchanged` outcome
- **THEN** the relevant `NpcItem` row is transferred from the source NPC to the target NPC

#### Scenario: Conversation can update an NPC's agenda
- **WHEN** a conversation outcome includes a `newAgenda` for one of the participants
- **THEN** `Npc.agenda` is updated for that NPC during the atomic flush

#### Scenario: Conversation with no outcomes is a no-op
- **WHEN** Haiku returns an empty outcome for a conversation pair
- **THEN** no NpcRelationship, NpcItem, or Npc rows are modified for that pair
