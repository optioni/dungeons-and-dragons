## ADDED Requirements

### Requirement: Campaign character sheet route displays complete character state
The system SHALL provide an authenticated `/campaign/[id]/character` page that displays the campaign character's current sheet state. The page SHALL include character name, race, class, level, armor class, initiative modifier, speed, proficiency bonus, hit points, maximum hit points, hit dice remaining, death-save state when relevant, experience points, and currency totals.

#### Scenario: Owner opens the character sheet
- **WHEN** the campaign owner opens `/campaign/[id]/character`
- **THEN** the page displays the campaign character's identity, level, core combat stats, current health, hit dice, XP, and currency without requiring a live game session stream

#### Scenario: Character is at zero hit points
- **WHEN** the displayed character has `hp` equal to 0 and is not dead
- **THEN** the page displays death-save successes and failures alongside the hit point state

### Requirement: Character sheet displays abilities, saves, and skills
The character sheet page SHALL display all six ability scores with their calculated modifiers, saving throw values, and all skill proficiencies with their calculated bonuses. Proficient and expert skills SHALL be visually distinguishable from untrained skills.

#### Scenario: Ability modifiers are visible
- **WHEN** the character sheet renders a character with ability scores
- **THEN** each ability score is shown with its D&D 5e modifier

#### Scenario: Skill proficiency affects displayed bonus
- **WHEN** a skill is marked proficient or expert
- **THEN** the displayed skill row shows the proficiency state and calculated bonus including the character's proficiency bonus

### Requirement: Character sheet displays conditions with rules context
The character sheet page SHALL display the character's active conditions and, when matching SRD condition data is available, SHALL expose the SRD condition description in the condition panel.

#### Scenario: Character has active conditions
- **WHEN** the character has one or more active condition names
- **THEN** the page lists each active condition in a dedicated conditions panel

#### Scenario: SRD condition description is available
- **WHEN** an active condition matches an `SrdCondition`
- **THEN** the page makes that condition's rules description available from the condition display

### Requirement: Character sheet displays spellcasting state
The character sheet page SHALL display spell slots grouped by spell level, spent versus available slot state, and prepared spell names for spellcasting characters. When SRD spell data is available for a prepared spell, the page SHALL expose spell details such as level, school, casting time, range, duration, and description.

#### Scenario: Spellcaster has spell slots
- **WHEN** the character has spell slot data
- **THEN** the page displays each spell level with total, spent, and remaining slot indicators

#### Scenario: Prepared spells are present
- **WHEN** the character has prepared spells
- **THEN** the page lists the prepared spells and exposes available SRD spell details for inspection

### Requirement: Character sheet displays inventory and currency as reference information
The character sheet page SHALL display all character inventory items with item name, description, item type, equipped slot or carried state, condition, weight, value, and available combat or armor stats. The campaign-info page SHALL NOT introduce new direct gameplay mutations; any existing inventory equip or unequip behavior is governed by the character inventory capability.

#### Scenario: Inventory contains equipped and carried items
- **WHEN** the character has equipped and carried `CharacterItem` rows
- **THEN** the page displays each item with its equip state, condition, and item details

#### Scenario: Currency values are present
- **WHEN** the character has gold, silver, and copper values
- **THEN** the page displays all three currency denominations

### Requirement: Character sheet is reachable from campaign navigation
The character sheet page SHALL be reachable from campaign-level navigation without the player manually constructing a `characterId` query parameter. Existing deep links with `?characterId=` SHALL remain supported when available.

#### Scenario: Player navigates from another campaign page
- **WHEN** the player selects the character sheet navigation item from another campaign page
- **THEN** the app opens `/campaign/[id]/character` and loads the campaign character

#### Scenario: Existing character id link is used
- **WHEN** the player opens `/campaign/[id]/character?characterId=<id>`
- **THEN** the page loads that owned character if it belongs to the campaign context
