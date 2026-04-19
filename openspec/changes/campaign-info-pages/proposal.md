## Why

The design spec defines two information pages — `/campaign/[id]/character` (full character sheet, inventory, spell list) and `/campaign/[id]/world` (factions, NPCs, diary view) — but neither has a change proposal. The API data already exists; these pages surface it for the player outside the main game view.

## What Changes

**Character page** (`/campaign/[id]/character`):
- Full character sheet: ability scores with modifiers, saving throws, skill proficiencies (with proficiency bonus), AC, initiative, speed, HP bar + max HP, hit dice.
- Conditions panel: active conditions with SrdCondition descriptions.
- Spell slots panel: slots by level with pips; prepared spells list with SrdSpell descriptions (for Wizard/Cleric/Druid).
- Inventory: CharacterItem list with equipped state, slot, condition, item stats (damage dice, AC bonus, weight, gold value). Equip/unequip via existing game engine mutations (or stubbed — items can only be equipped during session via LLM tools).
- Currency: gold / silver / copper.
- XP bar and current level.

**World page** (`/campaign/[id]/world`):
- Factions panel: name, goals, playerDisposition badge (colour-coded), powerLevel, territory location names.
- NPCs panel: paginated list of known NPCs (those the player has encountered); name, profession, disposition badge, currentLocation name, partyStatus indicator. Clicking an NPC shows their profile modal (description, motivation, speechStyle, relationships).
- Diary panel: paginated diary entries in reverse chronological order (last 7 prominently, older collapsed); each entry shows `inGameDate` and content.
- Active world events panel: status badge (ACTIVE / RESOLVED / EXPIRED), description, deadline in days remaining.

Both pages are read-only — all state mutations happen through the game session. Pages poll or use urql cache; no real-time subscription needed.

## Capabilities

### New Capabilities
- `character-sheet-page`: Full character sheet at `/campaign/[id]/character` — stats, conditions, spells, inventory, currency, XP.
- `world-overview-page`: World state viewer at `/campaign/[id]/world` — factions, NPC roster, diary, active world events.

### Modified Capabilities
- `api-graphql`: New queries — `character(campaignId)` (if not already exposed with all fields), `factions(campaignId)`, `npcs(campaignId, first, after)`, `diaryEntries(campaignId, first, after)`, `worldEvents(campaignId, status?)` — add any missing resolvers.

## Impact

- Frontend — two new Nuxt pages with Nuxt UI components; urql queries for character, factions, NPCs, diary, world events
- API — audit existing resolvers/queries; add any missing fields (NPC list with pagination, faction list, diary entry list, world event list)
- No new entities or migrations
- Depends on `character-system`, `memory-system`, `game-engine`, `world-system`
