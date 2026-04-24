## Why

The current DM stream is entirely reactive — the character has no felt inner life, and ability scores only matter when the player explicitly calls for a check. Inspired by Disco Elysium's skill-voice system, this change introduces a character inner monologue: a brief, post-turn stream of the character's thoughts, filtered through their personality and shaped by server-rolled passive checks, so high-WIS characters notice things low-WIS characters miss and failed checks produce confident wrong reads.

## What Changes

- `Character` entity gains four new fields: `personalityTraits`, `ideals`, `bonds`, `flaws` (text arrays) — populated during the character-creation flow and used to ground the inner voice
- `ContextLoader.loadWorldBlock` extended to include ability scores, skill proficiencies, race, and class name (currently omitted from the character sheet block)
- Server-side passive check rolling runs before the inner monologue call — d20 + modifier per relevant skill, compared against a scene DC; the roll outcome is passed as an explicit instruction to the LLM, not resolved by it
- New `INNER_VOICE` chunk type added to `DmStreamChunkType`
- After each DM turn completes, a secondary Haiku call generates 2–3 sentences of inner monologue, streaming as `INNER_VOICE` chunks — the LLM authors prose only; outcomes are already decided by the dice
- Frontend renders inner voice in a visually distinct style below the DM narrative (italicised, muted tone, clearly character-owned)
- The character-creation flow is extended to populate `personalityTraits`, `ideals`, `bonds`, `flaws` alongside the existing character fields

## Capabilities

### New Capabilities
- `character-inner-monologue`: Post-turn Haiku call that generates the character's inner monologue, gated by server-rolled passive checks; streams as `INNER_VOICE` chunks and renders as a distinct UI track.
- `character-personality`: `personalityTraits`, `ideals`, `bonds`, `flaws` fields on `Character` entity; populated during character creation and surfaced in context for both the DM and inner monologue prompts.

### Modified Capabilities
- `session-and-llm`: `DmStreamChunkType` gains `INNER_VOICE`; `DmOrchestrator` fires the inner monologue call post-turn; `ContextLoader.loadWorldBlock` expanded with ability scores, proficiencies, race, and class.
- `character-creation`: the existing character-creation flow must populate personality fields in addition to the current name/race/class/ability-score inputs.

## Impact

- `Character` entity — four new nullable text-array columns; migration required
- Character creation path (`apps/web/pages/campaign/[id]/setup.vue` + `CharacterService.create`) — extended to populate personality fields
- `ContextLoader` — `loadWorldBlock` extended; no cache breakpoint changes (ability scores and personality are part of block 3 already)
- `DmOrchestrator` — inner monologue call fires after `runToolLoop` resolves, before DONE chunk; new `InnerMonologueService` injected
- `DmStreamChunkType` — new `INNER_VOICE` enum member; `DmStreamChunk` DTO unchanged structurally (uses existing `text` field)
- Frontend — `INNER_VOICE` chunk handling in the game view subscription; new inner voice display component
- No new DB tables; no relay pagination changes; no world tick impact
