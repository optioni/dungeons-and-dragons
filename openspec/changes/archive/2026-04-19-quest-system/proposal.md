## Why

Quests give the player structured goals that tie to NPC agendas and world state. Rather than abstract objective flags, quest progress is tracked through real entity state — NPCs, locations, items — with an auto-checker that completes objectives automatically when the underlying world state changes. Quests are scaffolded with all necessary entities at creation time.

## What Changes

- `Quest`, `QuestObjective`, `QuestEntity` entities
- `create_quest` tool — creates quest + scaffolds all dependent entities (locations, NPCs, items, world events) in one operation; links them via QuestEntity; generates agendaImpact
- Quest objective types: `REACH_LOCATION`, `NPC_DEAD`, `NPC_ALIVE`, `HAVE_ITEM`, `TALK_TO_NPC`, `MANUAL`
- Auto-checker: indexed query on `QuestObjective` after each state-changing tool call; notifies LLM when all objectives complete
- `complete_quest` / `fail_quest` tools — apply rewards, call `update_npc` with agendaImpact
- `update_quest_objective` tool — for MANUAL objectives
- Quests page in web (`/campaign/[id]/quests`) — active/completed quests, objective checklist

## Capabilities

### New Capabilities
- `quest-entities`: Quest, QuestObjective, QuestEntity entities and GraphQL queries
- `quest-scaffolding`: `create_quest` tool that spawns all supporting world entities atomically
- `quest-auto-checker`: Indexed objective completion detection after each tool call, LLM notification on quest completion
- `quest-ui`: Quests page with active/completed list and objective progress

### Modified Capabilities
- `game-engine`: Auto-checker hook added to all state-changing tools (travel_to, apply_damage, give_item, update_npc)
- `world-entities`: NPC, Location, Item creation via quest scaffolding linked through QuestEntity

## Impact

- Quest entities added to `GameEngineModule` (tools) and a new resolver in `api/`
- Depends on `game-engine`, `campaign-setup`, `character-system`
- Auto-checker adds a lightweight indexed query after every tool call — must not add meaningful latency
