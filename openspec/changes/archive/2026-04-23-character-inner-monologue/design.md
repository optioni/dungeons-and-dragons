## Context

The DM orchestrator runs a Sonnet tool-loop per player turn and emits `NARRATIVE_CHUNK` stream events. After the loop resolves, only a `DONE` chunk is published — there is no secondary processing step. The `Character` entity has `abilityScores` and `skillProficiencies` but no personality fields (traits, ideals, bonds, flaws). `ContextLoader.loadWorldBlock` sends name, level, HP, AC, conditions, and spell slots but omits ability scores, skill proficiencies, race, and class — information the inner monologue needs.

The world-tick and diary systems already use Haiku for fast, cheap background LLM calls; this change follows the same pattern.

## Goals / Non-Goals

**Goals:**
- Generate a 2–3 sentence character inner monologue after each DM turn in applicable scene types
- Ground the monologue in the character's personality (traits, ideals, bonds, flaws) and in skill checks the AI selects as narratively relevant, rolled by the server
- Make failed checks produce confident wrong reads (Insight) or silence (Perception) — the AI authors prose from the result, cannot alter it
- Stream the monologue as `INNER_VOICE` chunks so the frontend can render it distinctly from DM narrative
- Keep the Haiku call latency invisible to the player (fires after DONE, rendered as a trailing element)

**Non-Goals:**
- Firing the inner monologue during COMBAT or REST scenes
- Persisting inner monologue text to the GameEvent log or diary
- Letting the character interact with or respond to their own inner voice
- Pre-selecting which skills to roll — the AI chooses based on scene context, capped at 2 calls

## Decisions

### Separate `InnerMonologueService` in `LLMModule`

The monologue call is extracted into its own service rather than added inline to `DmOrchestrator`. `DmOrchestrator` calls `innerMonologueService.runIfApplicable(sessionId, sceneType, narrativeText)` after `runToolLoop` resolves and before emitting `DONE`.

Rationale: `DmOrchestrator` is already complex (tool loop, event persistence, stream publishing). Keeping the monologue as a dependency keeps responsibilities clean and makes the service independently testable.

Alternatives considered:
- Inline in `DmOrchestrator`. Rejected — the method is already long; the monologue has its own context assembly, rolling logic, and Haiku client.
- A BullMQ job. Rejected — the monologue must stream before DONE; a queue adds unnecessary async indirection.

### AI selects relevant skills via tool calls; server rolls the dice

The inner monologue Haiku call runs a mini tool-loop with a single available tool: `roll_skill_check(skill: SkillName)`. The AI sees the scene, character sheet, and DM narrative, then calls the tool for whichever 1–2 skills it judges most narratively relevant. The server rolls `d20 + modifier` and returns the structured result:

```json
{ "skill": "insight", "rolled": 7, "modifier": -1, "total": 6, "dc": 12, "success": false }
```

The AI then generates the monologue prose grounded in the actual outcomes. It cannot alter the roll — it can only choose which skills to invoke.

DC 12 is fixed. At DC 12: a +3 modifier (WIS 16) succeeds ~60% of turns; a −1 modifier (WIS 8) succeeds ~40%. This produces meaningful differentiation without guaranteeing either outcome.

Tool call cap is 2. After 2 rolls the loop forces `end_turn` and the AI writes prose from whatever results it has. This prevents fishing for successes by rolling many skills.

The system prompt instructs the AI to choose skills relevant to the scene, not skills the character is statistically likely to succeed at. A WIS 8 character may still choose Insight when an NPC interaction demands it — and will often fail, producing the interesting wrong-read.

Eligible skills (the only ones available to the tool): Perception (WIS), Insight (WIS), Investigation (INT), History (INT), Arcana (INT), Survival (WIS). Action skills (Athletics, Stealth, Deception, etc.) are excluded — they have no inner-monologue analogue.

Rationale: The AI is better placed than the server to judge which skill is dramatically interesting for a specific scene. A rigid server-side mapping (e.g., SOCIAL → always Insight) misses cases like a dungeon where the character's History matters more than Perception. Tool calls keep the roll outcome server-authoritative while giving the AI contextual judgment over what to check.

Alternatives considered:
- Server pre-rolls a fixed set, AI picks which to reference. Rejected — AI could still cherry-pick successes from the pre-rolled set; the cap on tool calls is a cleaner constraint.
- Server pre-selects skills by scene type. Rejected — too rigid; misses contextually interesting checks.
- AI generates prose from stat values alone with no rolls. Rejected — eliminates the variance that makes wrong reads possible for high-stat characters and lucky moments possible for low-stat ones.

### Scene type guard: EXPLORATION, SOCIAL, SETTLEMENT, DUNGEON only

`InnerMonologueService.runIfApplicable` returns immediately without a Haiku call when `sceneType` is `COMBAT` or `REST`.

Rationale: COMBAT is too fast-paced for introspection and the combat UI is already dense. REST is low-stakes and reflective moments are better served by the diary system, which already runs post-rest.

### Personality fields added to `Character` entity

Four new nullable text-array columns: `personalityTraits: string[]`, `ideals: string[]`, `bonds: string[]`, `flaws: string[]`. Nullable to avoid breaking existing campaigns; inner monologue falls back to race/class/background inference when empty.

These fields are populated in the existing character-creation flow rather than in `CampaignSetupService`. In the current repo, character creation happens through the setup page's `createCharacter` mutation and `CharacterService.create`; any personality generation step must attach to that path instead of the story concept / world seed setup service.

Rationale: D&D 5e character sheets explicitly include these fields. Without them, the inner voice has no grounding beyond stat values and must infer personality entirely from race/class — which works but produces generic output.

### `loadWorldBlock` extended, no new cache breakpoint

Ability scores, skill proficiencies, race name, and class name added to the character sheet section of block 3. Personality fields added there too. No new breakpoint is introduced — these fields change only when the character is created or levels up, so they belong in block 3 alongside HP and conditions.

The inner monologue Haiku call does NOT use the four-block prompt cache structure. Its system prompt is short (character identity + personality) and its user turn changes every call (DM narrative + roll results). Caching offers no meaningful benefit at Haiku pricing.

### `INNER_VOICE` reuses the existing `text` field on `DmStreamChunk`

`DmStreamChunkType` gains `INNER_VOICE`. The chunk DTO is unchanged — `text` carries the monologue fragment, same as `NARRATIVE_CHUNK`. The frontend distinguishes them by `type`.

Rationale: No schema migration needed. The frontend already switches on `type` for rendering decisions.

### Monologue streams after DONE, rendered as a trailing element

`InnerMonologueService` emits `INNER_VOICE` chunks and then a second `DONE` chunk. The frontend treats the first `DONE` as "main narrative complete" and the second `DONE` as "monologue complete". The monologue renders below the DM narrative in italics with a muted style — visually owned by the character, not the DM.

Alternatively: emit before DONE. Rejected — this would delay the DONE signal and hold the player's input field disabled while Haiku generates the monologue, adding perceived latency to every turn.

## Risks / Trade-offs

- **Latency visibility** — Haiku adds ~1–2 s after DONE. Mitigated by streaming after the input field unlocks; the player can type while the monologue appears.
- **Monologue quality with empty personality fields** — Existing campaigns have no traits/ideals/bonds/flaws. Mitigated by fallback language in the system prompt ("draw on their race and class background") and by the fields being set on any newly created character.
- **AI cherry-picking high-chance skills** — The AI may tend to invoke skills the character is good at. Mitigated by system prompt instruction ("choose what's narratively relevant, not what you'll likely succeed at") and the 2-call cap preventing exhaustive fishing. Accepted as a partial risk — some bias is acceptable if the monologue remains contextually grounded.
- **Tool-loop latency** — Each `roll_skill_check` call adds a round trip. Two calls at Haiku speed adds ~500ms–1s total. Mitigated by firing after DONE; the player's input is already unlocked.
- **Two DONE chunks** — The frontend must handle a second DONE without breaking. Mitigated by making DONE idempotent — the frontend ignores a DONE if already in idle state.

## Open Questions

- Should the monologue be toggleable by the player (opt-in/opt-out)? Not scoped here — can be added as a user preference later.
- Should failed-check wrong reads ever be flagged retroactively (e.g., if the player later discovers the truth)? Not scoped — would require persisting monologue text and linking it to outcomes.
