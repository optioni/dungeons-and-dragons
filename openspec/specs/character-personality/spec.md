# character-personality Specification

## Purpose
TBD - created by archiving change character-inner-monologue. Update Purpose after archive.
## Requirements
### Requirement: Character entity stores personality fields
The `Character` entity SHALL have four nullable text-array columns: `personalityTraits: string[]`, `ideals: string[]`, `bonds: string[]`, `flaws: string[]`. All four SHALL default to empty arrays. Existing characters with no personality data SHALL be valid — the fields SHALL never be required for other game functionality.

#### Scenario: New character created with personality fields
- **WHEN** a character is created with personality data
- **THEN** `personalityTraits`, `ideals`, `bonds`, and `flaws` are persisted and retrievable

#### Scenario: Existing character without personality fields remains valid
- **WHEN** a character record has empty personality arrays
- **THEN** all game systems continue to function; inner monologue falls back to race/class inference

### Requirement: Personality fields exposed on the Character GraphQL type
The `Character` GraphQL `ObjectType` SHALL expose `personalityTraits`, `ideals`, `bonds`, and `flaws` as `[String!]!` fields (non-null array, nullable items not permitted).

#### Scenario: Character query returns personality fields
- **WHEN** a client queries a character
- **THEN** `personalityTraits`, `ideals`, `bonds`, and `flaws` are present in the response

### Requirement: Personality fields included in the DM context
`ContextLoader.loadWorldBlock` SHALL include personality traits, ideals, bonds, and flaws in the character sheet section of block 3, alongside the existing ability scores and skill proficiencies expansion. When all personality arrays are empty the section SHALL be omitted rather than emitting empty labels.

#### Scenario: Personality included in world block when populated
- **WHEN** the character has at least one personality field with content
- **THEN** `loadWorldBlock` includes the personality section in the returned string

#### Scenario: Personality omitted from world block when empty
- **WHEN** all personality arrays are empty
- **THEN** `loadWorldBlock` does not include a personality section

