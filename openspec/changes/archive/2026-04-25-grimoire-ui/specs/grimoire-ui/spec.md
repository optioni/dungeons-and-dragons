## ADDED Requirements

### Requirement: Visual token system
The web app SHALL define a set of CSS custom properties under `@theme` in `main.css` that form the complete grimoire colour palette. All components SHALL reference these tokens rather than hardcoded colour values or raw Tailwind gray-* utilities. The tokens SHALL cover three background elevation levels, two text levels, two accent levels, and one danger level.

#### Scenario: Token definitions present
- **WHEN** `main.css` is parsed
- **THEN** the following tokens are defined: `--color-grimoire-bg` (`#1a1510`), `--color-grimoire-surface` (`#211c17`), `--color-grimoire-raised` (`#2a2318`), `--color-grimoire-text` (`#e8d5b0`), `--color-grimoire-muted` (`#8a7660`), `--color-grimoire-accent` (`#c8922a`), `--color-grimoire-accent-dim` (`#7a5418`), `--color-grimoire-combat` (`#1f0a0a`)

#### Scenario: Nuxt UI primary scoped to play page
- **WHEN** an element is inside `.play-page`
- **THEN** `--ui-color-primary` resolves to `var(--color-grimoire-accent)`

#### Scenario: No raw gray utilities on grimoire screens
- **WHEN** any play, setup, auth, character, quests, or campaign-end screen is rendered
- **THEN** no `bg-gray-950`, `bg-gray-900`, or `bg-gray-800` classes appear on structural containers

### Requirement: Typography system
The web app SHALL use a three-font system: IM Fell English for narrative prose, Cinzel for UI chrome labels and headings, and monospace for numeric readouts. Both serif fonts SHALL be loaded via `@fontsource` packages registered in `nuxt.config.ts`. No screen in the campaign section SHALL use Inter, Roboto, or system-UI as a visible font.

#### Scenario: IM Fell English applied to narrative content
- **WHEN** a DM narrative block, quest description, character name on the sheet, epitaph text, or setup step heading is rendered
- **THEN** the element uses `font-family: 'IM Fell English', serif` at a minimum size of 16px

#### Scenario: Cinzel applied to UI chrome
- **WHEN** a section label, navigation link, stat heading, scene type indicator, progress step label, or badge is rendered
- **THEN** the element uses `font-family: 'Cinzel', serif` with `text-transform: uppercase` and wide letter-spacing

#### Scenario: Monospace for numeric values
- **WHEN** HP values, AC, initiative rolls, ability scores, or spell-slot counts are rendered
- **THEN** the element uses `font-mono` and does NOT use either serif font

#### Scenario: Font packages registered
- **WHEN** `nuxt.config.ts` is read
- **THEN** `@fontsource/im-fell-english/400.css`, `@fontsource/im-fell-english/400-italic.css`, and `@fontsource/cinzel/400.css` are present in the `css` array

### Requirement: Global background and noise texture
Every page in the app SHALL use `--color-grimoire-bg` as the page floor colour. The play page wrapper SHALL apply a fixed-position SVG `feTurbulence` noise overlay at low opacity to suggest aged parchment depth without impacting scroll performance.

#### Scenario: Body background colour
- **WHEN** any page in the app loads
- **THEN** the root element has `background-color: var(--color-grimoire-bg)`

#### Scenario: Noise texture present on play page
- **WHEN** the play page is rendered
- **THEN** a fixed-position pseudo-element exists with an SVG `feTurbulence` data-URI background at `opacity ≤ 0.05` and `pointer-events: none`

#### Scenario: Texture does not cause scroll repaints
- **WHEN** the user scrolls the transcript
- **THEN** the noise overlay remains fixed (does not scroll with content)

### Requirement: Play view layout — book header replaces sidebar
The play page SHALL render a `PlayHeader` component spanning the full width above the transcript area. The `CharacterSidebar` component SHALL be removed. The transcript and input area SHALL be the only content below the header.

#### Scenario: No sidebar column present
- **WHEN** the play page renders
- **THEN** no element with class `w-56` or `CharacterSidebar` exists in the DOM

#### Scenario: PlayHeader renders location name
- **WHEN** the active session has a current location
- **THEN** `PlayHeader` displays the location name in IM Fell English as the dominant text element

#### Scenario: PlayHeader renders scene type
- **WHEN** the session `sceneType` is `EXPLORATION`
- **THEN** `PlayHeader` displays `EXPLORATION` in Cinzel uppercase tracking-widest

#### Scenario: PlayHeader renders in-game date
- **WHEN** the campaign has an `inGameDate` value
- **THEN** `PlayHeader` displays the formatted in-game date in Cinzel muted text

#### Scenario: PlayHeader HP strip reflects health state
- **WHEN** character HP is above 50% of max
- **THEN** the HP strip fill colour is `--color-grimoire-accent` (amber)
- **WHEN** character HP is between 25% and 50% of max
- **THEN** the HP strip fill colour is orange
- **WHEN** character HP is at or below 25% of max
- **THEN** the HP strip fill colour is red and the fill element has a breathing animation

### Requirement: Transcript prose layout
The transcript SHALL render DM narrative as full-width prose paragraphs in a `max-w-2xl` centred column with an amber left-gutter border. Player input SHALL appear as an italic logbook annotation using the character's name. Chat bubble markup SHALL NOT be present.

#### Scenario: No bubble elements
- **WHEN** the transcript renders any event
- **THEN** no element with classes `rounded-2xl`, `justify-end`, or `justify-start` wrapping event content exists

#### Scenario: DM narrative gutter border
- **WHEN** a `DM_NARRATIVE` event renders
- **THEN** the container has `border-left: 2px solid` using `--color-grimoire-accent-dim`

#### Scenario: Prose column width
- **WHEN** the transcript area renders on a viewport wider than 768px
- **THEN** the prose column is constrained to `max-w-2xl` and centred with `mx-auto`

#### Scenario: Player annotation uses character name
- **WHEN** a `PLAYER_INPUT` event renders
- **THEN** the label prefix is the character's name (not "You:") rendered in Cinzel

#### Scenario: Player annotation is italic and inset
- **WHEN** a `PLAYER_INPUT` event renders
- **THEN** the text is italic, smaller than DM narrative, and indented relative to the gutter

### Requirement: Drop cap on first DM narrative
The first `DM_NARRATIVE` event in the loaded transcript SHALL display a large decorative drop cap on the first letter of the first paragraph. The drop cap SHALL use IM Fell English, amber colour, and a faint amber glow. Subsequent DM events SHALL NOT display a drop cap.

#### Scenario: Drop cap present on first event
- **WHEN** the first `DM_NARRATIVE` event renders
- **THEN** `::first-letter` on the first `<p>` has `font-size ≥ 4em`, `float: left`, and `color: var(--color-grimoire-accent)`

#### Scenario: Drop cap absent on subsequent events
- **WHEN** the second or later `DM_NARRATIVE` event renders
- **THEN** no `first-dm-narrative` class is applied to its container

#### Scenario: No drop cap on non-paragraph openings
- **WHEN** a DM narrative begins with a heading or blockquote element
- **THEN** no drop cap is rendered (graceful degradation — `::first-letter` does not fire on non-paragraph elements)

### Requirement: Ornamental divider between exchanges
An ornamental divider (`───── ✦ ─────`) SHALL render between exchanges. It SHALL only appear when a `DM_NARRATIVE` event follows a `PLAYER_INPUT` event. It SHALL NOT appear at the start of a session before the player has acted.

#### Scenario: Divider between exchange pairs
- **WHEN** the event list contains the sequence `[DM_NARRATIVE, PLAYER_INPUT, DM_NARRATIVE]`
- **THEN** one ornamental divider appears between the player input annotation and the second DM narrative block

#### Scenario: No divider at session start
- **WHEN** the transcript contains only a `DM_NARRATIVE` event (no prior player input)
- **THEN** no ornamental divider is rendered

#### Scenario: Divider is not interactive
- **WHEN** the ornamental divider renders
- **THEN** it has `aria-hidden="true"` and `user-select: none`

### Requirement: Inner monologue annotation
When `innerVoiceText` is present, it SHALL render as a small italic marginal annotation inset from the main column, visually distinct from both DM narrative and player input, using `⟨ ⟩` angle bracket framing.

#### Scenario: Inner monologue renders as annotation
- **WHEN** `innerVoiceText` prop has a value
- **THEN** the text renders italic, at `text-xs` or `text-sm`, with `opacity < 0.7`, inset from the main gutter

#### Scenario: Angle bracket framing
- **WHEN** inner monologue text renders
- **THEN** `⟨` appears before and `⟩` appears after the text content

### Requirement: Suggested actions as narrative prompts
Suggested actions SHALL render as a horizontal sequence of inline italic IM Fell English text fragments separated by `·` glyphs. They SHALL NOT render as pill buttons or bordered chips. Each fragment SHALL be individually clickable to populate the input field.

#### Scenario: No pill button rendering
- **WHEN** `suggestedActions` has at least one value
- **THEN** no `UButton` or element with button-like border/background styling is rendered for the suggestions

#### Scenario: Inline fragment separator
- **WHEN** two or more suggested actions are present
- **THEN** a `·` glyph in `--color-grimoire-accent-dim` appears between each pair of fragments

#### Scenario: Click populates input
- **WHEN** the user clicks a suggested action fragment
- **THEN** the player input field is populated with that action's text

#### Scenario: Cleared on submit
- **WHEN** the player submits their input
- **THEN** all suggested action fragments are removed from the DOM

### Requirement: Borderless logbook input
The player input textarea SHALL have no visible border in its default state. On focus, an amber left border SHALL appear matching the DM narrative gutter style. The placeholder text SHALL be `"What do you do, adventurer?"` in italic. The submit control SHALL be a Cinzel text element, not a filled button.

#### Scenario: No border in default state
- **WHEN** the input textarea is rendered and not focused
- **THEN** no visible border surrounds the textarea

#### Scenario: Amber gutter on focus
- **WHEN** the textarea receives focus
- **THEN** a `border-left: 2px solid var(--color-grimoire-accent)` appears

#### Scenario: Placeholder text
- **WHEN** the textarea is empty
- **THEN** the placeholder reads `"What do you do, adventurer?"` in italic styling

#### Scenario: Submit control is text-only
- **WHEN** the input area renders
- **THEN** the submit element has no background colour, no border, and uses Cinzel uppercase text

### Requirement: Streaming indicator
While the DM is streaming a response, a breathing amber dot with a Cinzel label SHALL replace the previous block cursor indicator. The breathing animation SHALL use a 2.4-second ease-in-out cycle.

#### Scenario: Breathing dot visible during stream
- **WHEN** `isStreaming` is true and `inProgressText` is non-empty
- **THEN** an element with `grimoire-breathe` animation class and `background-color: var(--color-grimoire-accent)` is visible

#### Scenario: Cinzel label present
- **WHEN** the streaming indicator renders
- **THEN** a Cinzel uppercase label (e.g. "The DM writes") is adjacent to the dot

#### Scenario: Animation timing
- **WHEN** the `grimoire-breathe` keyframe is inspected
- **THEN** the animation duration is `2.4s` with `ease-in-out` and `infinite` iteration

#### Scenario: No block cursor
- **WHEN** the streaming indicator is active
- **THEN** no element with `inline-block w-1.5 h-4 animate-pulse` (the previous cursor) exists

### Requirement: Combat atmosphere
The `CombatPanel` SHALL use `--color-grimoire-combat` as its background. The play page floor SHALL transition toward a danger tint over 0.8s when combat is active. A radial vignette SHALL darken the panel edges. The active-turn combatant highlight SHALL use amber, not blue.

#### Scenario: Combat panel background
- **WHEN** `CombatPanel` renders
- **THEN** its root element has `background-color: var(--color-grimoire-combat)`

#### Scenario: Page floor combat tint
- **WHEN** `isCombat` transitions from false to true
- **THEN** the `.grimoire-bg` element's background-color transitions over `0.8s` toward a colour mixing grimoire-bg and grimoire-combat

#### Scenario: Radial vignette present
- **WHEN** `CombatPanel` renders
- **THEN** a `::after` pseudo-element with a radial gradient darkening toward the edges is present on the panel wrapper

#### Scenario: Amber active-turn highlight
- **WHEN** a combatant is the active turn
- **THEN** its container uses `--color-grimoire-accent/10` background and `--color-grimoire-accent/40` ring, not primary blue

### Requirement: New event entry animation
DM narrative and player annotation elements appended to the transcript AFTER the initial page load SHALL animate in with a fade-and-rise effect. Events present on mount SHALL render without animation.

#### Scenario: Animation on new events
- **WHEN** a new `DM_NARRATIVE` or `PLAYER_INPUT` event is appended after mount
- **THEN** the element applies `grimoire-entry` class producing a `0.5s ease-out` opacity 0→1 and translateY 5px→0 animation

#### Scenario: No animation on historical events
- **WHEN** the play page mounts and renders a backlog of existing events
- **THEN** none of those event elements have the `grimoire-entry` animation class applied

### Requirement: Campaign end screen
The campaign end screen SHALL render the character's epitaph as a large italic IM Fell English passage with no card border or background. The character name SHALL be prominent. Stats SHALL use monospace numerals. The restart control SHALL be a Cinzel text link. The screen SHALL fade in over 1.5 seconds on mount.

#### Scenario: Fade-in on mount
- **WHEN** `CampaignEndScreen` mounts
- **THEN** the root element has a `1.5s ease` opacity animation from 0 to 1

#### Scenario: Epitaph as floating prose
- **WHEN** the epitaph is rendered
- **THEN** it uses IM Fell English italic at `text-xl` or larger with no border, card background, or rounded container

#### Scenario: Character name displayed
- **WHEN** `CampaignEndScreen` renders
- **THEN** the character's name is displayed in IM Fell English at `text-3xl` or larger

#### Scenario: Stats in monospace
- **WHEN** `daysPlayed` and `questsCompleted` render
- **THEN** the numeric values use `font-mono` at a large size with Cinzel labels

#### Scenario: No skull icon
- **WHEN** `CampaignEndScreen` renders
- **THEN** no `i-lucide-skull` icon is present in the DOM

#### Scenario: Restart is a text link
- **WHEN** the restart control renders
- **THEN** it is a Cinzel text element with no filled background, styled with an amber underline or colour

### Requirement: Auth page grimoire identity
The auth page SHALL present as a grimoire cover — a centred wordmark above a borderless form column. It SHALL NOT use `UCard` as the form container. Form field labels SHALL use Cinzel. The submit button SHALL use `--color-grimoire-accent` as its background with dark text.

#### Scenario: No UCard wrapper
- **WHEN** the auth page renders
- **THEN** no `UCard` component wraps the login or registration form

#### Scenario: Wordmark present
- **WHEN** the auth page loads
- **THEN** a large IM Fell English title is displayed above the form

#### Scenario: Amber submit button
- **WHEN** the login or register submit button renders
- **THEN** its background is `--color-grimoire-accent` and text is dark (not white)

### Requirement: Setup wizard atmospheric styling
The setup wizard SHALL remove all `UCard` containers and replace them with borderless step panels. The progress indicator SHALL use Cinzel text labels, not numbered circles. Step headings SHALL be renamed to narrative equivalents in IM Fell English. Story concept cards SHALL display premise, conflict, and antagonist hint as prose — not labeled "Concept 1/2/3".

#### Scenario: No UCard step containers
- **WHEN** any wizard step renders
- **THEN** no `UCard` component wraps the step content

#### Scenario: Cinzel progress indicator
- **WHEN** the wizard progress indicator renders
- **THEN** step labels use Cinzel uppercase text; the current step has an amber underline; no circle elements are present

#### Scenario: Narrative step headings
- **WHEN** the character name step renders
- **THEN** the heading reads "Name your hero" (not "Name your character")
- **WHEN** the race selection step renders
- **THEN** the heading reads "Choose your lineage"
- **WHEN** the class selection step renders
- **THEN** the heading reads "Choose your calling"

#### Scenario: Concept cards show prose content
- **WHEN** the concept selection step renders
- **THEN** each concept card displays a Roman numeral (I, II, III) label and the premise text in IM Fell English — no "Concept 1" / "Concept 2" text is present

#### Scenario: Concept antagonist hint is italic
- **WHEN** a concept card renders
- **THEN** the `antagonistHint` field is displayed in italic IM Fell English below a hairline separator

#### Scenario: Permadeath card danger treatment
- **WHEN** the PERMADEATH death mode option is selected
- **THEN** the card uses a red-tinted selected state (`bg-red-950/30 border-red-800/50`) rather than amber

#### Scenario: World generation loading state
- **WHEN** `submitting` is true on the world generation step
- **THEN** the generate button is replaced by a breathing amber dot with IM Fell English italic text (e.g. "The world takes shape...")

#### Scenario: Campaign ready state
- **WHEN** `setupStatus` is `READY_TO_PLAY`
- **THEN** the screen displays an IM Fell English heading (e.g. "The world is ready.") and a Cinzel text link — no green icon and no `UButton`

### Requirement: Loading states preserve fiction
Every loading state in the app SHALL use a breathing amber dot and an IM Fell English italic phrase rather than a generic spinner icon and plain text.

#### Scenario: Play page loading
- **WHEN** the play page is loading the session
- **THEN** the text reads approximately "The grimoire stirs..." in italic IM Fell English and a `grimoire-breathe` amber dot is visible

#### Scenario: No lucide-loader-circle in campaign screens
- **WHEN** any of the play, character, quests, setup, or campaign-end screens is in a loading state
- **THEN** no `i-lucide-loader-circle animate-spin` element is rendered

#### Scenario: Context-appropriate loading phrases
- **WHEN** the character sheet is loading
- **THEN** the loading phrase references the context (e.g. "Reading the chronicle...")
- **WHEN** the quest log is loading
- **THEN** the loading phrase references the context (e.g. "Consulting the scroll...")
