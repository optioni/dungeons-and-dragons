## ADDED Requirements

### Requirement: Dice tool results are persisted as DICE_ROLL game events
The system SHALL persist a `DICE_ROLL` game event immediately after any `check_skill`, `check_ability`, or `roll_dice` tool call is dispatched, in addition to the existing `TOOL_CALL` event. The `DICE_ROLL` event SHALL be written to the `game_event` table with a jsonb `content` field shaped according to the tool that fired it.

For `check_skill` and `check_ability`, the content SHALL include: `tool`, `skill` (if applicable), `ability` (if applicable), `roll`, `modifier`, `total`, `dc`, and `passed`.

For `roll_dice`, the content SHALL include: `tool`, `expression`, `rolls`, and `total`. No `dc` or `passed` fields are present.

#### Scenario: check_skill fires and persists a DICE_ROLL event
- **WHEN** the DM calls `check_skill` with skill "Persuasion" and DC 12 during an active session
- **THEN** a `DICE_ROLL` game event is appended with `{ tool: "check_skill", skill: "Persuasion", roll, modifier, total, dc: 12, passed }`

#### Scenario: check_ability fires and persists a DICE_ROLL event
- **WHEN** the DM calls `check_ability` with ability "STR" and DC 15 during an active session
- **THEN** a `DICE_ROLL` game event is appended with `{ tool: "check_ability", ability: "STR", roll, modifier, total, dc: 15, passed }`

#### Scenario: roll_dice fires and persists a DICE_ROLL event
- **WHEN** the DM calls `roll_dice` with expression "2d6+3" during an active session
- **THEN** a `DICE_ROLL` game event is appended with `{ tool: "roll_dice", expression: "2d6+3", rolls: [number, number], total }`

#### Scenario: Failed tool call does not persist a DICE_ROLL event
- **WHEN** `check_skill` returns a structured error (e.g. CHARACTER_NOT_FOUND)
- **THEN** no `DICE_ROLL` event is appended

### Requirement: Roll cards are rendered in the transcript for DICE_ROLL events
The frontend transcript SHALL render a `DICE_ROLL` game event as an inline roll card between the surrounding events. The card SHALL display the skill or ability name (if present), the d20 roll, the modifier, the total, the DC (if present), and a pass/fail indicator.

For `roll_dice` events without a DC, the card SHALL display the dice expression, individual roll values, and the total only — no pass/fail indicator.

The roll card SHALL animate in using `.grimoire-entry` on mount, consistent with narrative blocks.

#### Scenario: Skill check roll card shows full breakdown
- **WHEN** a `DICE_ROLL` event with `tool: "check_skill"`, `skill: "Persuasion"`, `roll: 14`, `modifier: 3`, `total: 17`, `dc: 12`, `passed: true` is rendered
- **THEN** the card displays "PERSUASION CHECK · DC 12" and "14 + 3 = 17 · ✦ Passed"

#### Scenario: Failed skill check roll card shows failure indicator
- **WHEN** a `DICE_ROLL` event with `passed: false` is rendered
- **THEN** the card displays "✕ Failed" in place of the pass indicator

#### Scenario: roll_dice card shows expression and individual rolls
- **WHEN** a `DICE_ROLL` event with `tool: "roll_dice"`, `expression: "2d6+3"`, `rolls: [3, 5]`, `total: 11` is rendered
- **THEN** the card displays "ROLL · 2d6+3" and "3 · 5 + 3 = 11" with no pass/fail indicator

#### Scenario: Roll card survives page reload
- **WHEN** the player reloads the page during or after a session
- **THEN** all `DICE_ROLL` events are fetched from the API and rendered in transcript order

### Requirement: Roll card visual treatment follows the Dark Grimoire design system
The roll card SHALL use a left border (`border-l-2 border-grimoire-accent-dim/40`), matching the narrative block convention. The skill/ability label SHALL use Cinzel xs uppercase tracking-widest in `text-grimoire-muted`. Numeric values (roll, modifier, total, DC) SHALL use `font-mono`. The pass indicator glyph (✦) SHALL use `text-grimoire-accent`; the fail indicator (✕) SHALL use `text-grimoire-muted/70`. No box-shadow, no rounded-lg, no colour outside the grimoire palette.

#### Scenario: Roll card does not use non-grimoire colours
- **WHEN** a roll card is rendered for any dice event
- **THEN** all colours used are exclusively from the grimoire CSS custom property palette (no blue, green, or purple)

### Requirement: DICE_ROLL events are included in the game events query
The GraphQL `gameEvents` query SHALL return `DICE_ROLL` events alongside `DM_NARRATIVE` and `PLAYER_INPUT` events in chronological order. The frontend SHALL request `DICE_ROLL` events in the session GraphQL fragment.

#### Scenario: DICE_ROLL events appear in the events list
- **WHEN** the frontend queries `gameEvents` for a session that had a skill check
- **THEN** the response includes a `DICE_ROLL` event between the `PLAYER_INPUT` and `DM_NARRATIVE` events that bracket it
