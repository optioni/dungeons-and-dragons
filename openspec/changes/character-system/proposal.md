## Why

The player's character is the central entity of the game. Before a campaign can start, the player must create a character — choosing race, class, and ability scores. The character sheet persists across sessions and must track all mechanical state: HP, conditions, spell slots, skill proficiencies, inventory, currency, and XP.

## What Changes

- `Character` entity — race, class, level, abilityScores, hp, maxHp, ac, conditions, spellSlots, preparedSpells, skillProficiencies, goldPieces, silverPieces, copperPieces, xp, proficiencyBonus, deathSaveSuccesses, deathSaveFailures, isDead
- `Item`, `CharacterItem` entities — inventory with equipped slots and condition tracking
- GraphQL mutations for character creation, equipping/unequipping items
- GraphQL queries for character sheet and inventory
- Character creation wizard pages in web (`/campaign/[id]/setup`)
- Character sheet page in web (`/campaign/[id]/character`)

## Capabilities

### New Capabilities
- `character-crud`: Character entity, creation flow, and sheet queries/mutations
- `character-inventory`: Item and CharacterItem entities, equip/unequip mechanics, currency tracking

### Modified Capabilities

## Impact

- New `CharacterModule` in `api/`
- Depends on `srd-data` (race/class reference) and `user-auth`
- `game-engine` depends on character state for all mechanical resolution
