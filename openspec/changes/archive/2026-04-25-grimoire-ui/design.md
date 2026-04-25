## Context

Every screen in the web app currently uses `bg-gray-950`, generic `UCard` components, `text-gray-*` colour hierarchy, and `font-bold text-white` headings. The play interface uses chat bubbles. The campaign end screen has a `text-6xl text-gray-500` skull and a bordered box for the epitaph. The auth page is a login form on a dark background indistinguishable from any SaaS product. The setup wizard presents story concepts labeled "Concept 1", "Concept 2", "Concept 3" in generic bordered cards. None of it communicates that the player is in a living D&D world narrated by an ancient intelligence.

This change applies a **Dark Grimoire** visual identity to every screen in the web app — establishing a coherent aesthetic from first login through campaign end.

The `markdown-rendering` change (now archived) landed `@tailwindcss/typography` prose rendering for DM narratives. This change layers the full identity on top of that foundation.

Affected files:
- `apps/web/assets/css/main.css` — all theme tokens, keyframes, grimoire utility classes
- `apps/web/nuxt.config.ts` — font CSS registration
- `apps/web/app.vue` — global body background
- `apps/web/pages/auth.vue` — grimoire cover page
- `apps/web/pages/campaign/[id]/play.vue` — full play view restructure
- `apps/web/pages/campaign/[id]/character.vue` — manuscript character sheet
- `apps/web/pages/campaign/[id]/setup.vue` — setup wizard
- `apps/web/pages/campaign/[id]/quests.vue` — quest log
- `apps/web/components/session/TranscriptView.vue` — logbook prose layout
- `apps/web/components/session/CharacterSidebar.vue` — removed; replaced by book header
- `apps/web/components/session/CombatPanel.vue` — danger atmosphere
- `apps/web/components/session/CampaignEndScreen.vue` — epitaph screen
- New: `apps/web/components/session/PlayHeader.vue`
- New: `apps/web/components/session/OrnamentalDivider.vue`

## Goals / Non-Goals

**Goals:**
- Establish a single coherent warm-dark grimoire identity across every screen
- Replace the play view sidebar with a manuscript book header; remove the sidebar entirely
- Replace chat bubbles with full-width prose transcript column (max-w-2xl, centered)
- Borderless logbook input activated by focus — player writes in the same register as the story
- Three-font system: IM Fell English (narrative), Cinzel (labels/chrome), monospace (numbers)
- Campaign end screen as an emotionally resonant epitaph moment
- Auth page as a grimoire cover — the first impression of the world
- Character sheet and quest log consistent with the grimoire identity
- Loading states that maintain the fiction
- Setup wizard as an atmospheric ritual: every step framed as a narrative act, not a form

**Non-Goals:**
- No API, GraphQL schema, or database changes (one exception noted below in Decisions)
- No animation library additions — CSS keyframes and Vue `<transition>` only
- No changes to the world or setup pages in this change (separate scope)
- No mobile-specific layout work — responsive at tablet level only

## Decisions

### Typography: three fonts, three roles

**IM Fell English** (narrative serif) via `@fontsource/im-fell-english`:
- All DM narrative prose, character sheet flavour text, quest descriptions, epitaph
- `font-size: 1.125rem` (18px) — not 16px; books print at 11–12pt which maps to 17–18px on screen; IM Fell English is slightly condensed and benefits from the extra size
- Italic variant for player input annotations, inner monologue, loading states

**Cinzel** (display serif / UI chrome) via `@fontsource/cinzel`:
- Section labels, navigation links, stat headings, scene type, in-game date, button labels, page titles
- Always `uppercase tracking-widest` at `text-xs` or `text-sm`
- The Roman lapidary letterforms read as carved stone — correct register for D&D categorical information

**Monospace** (numeric precision) — existing Tailwind `font-mono` stack:
- HP values, AC, initiative rolls, dice results, spell slot counts
- Numbers need alignment precision; neither serif font is suited for this

Installation:
```
yarn workspace web add @fontsource/im-fell-english @fontsource/cinzel
```
Registered in `nuxt.config.ts`:
```ts
css: [
  '@fontsource/im-fell-english/400.css',
  '@fontsource/im-fell-english/400-italic.css',
  '@fontsource/cinzel/400.css',
  '~/assets/css/main.css',
]
```

### Colour tokens: eight values covering the full surface hierarchy

Defined under `@theme` in `main.css` — no `tailwind.config.ts` (Tailwind v4 CSS-first):

```css
@theme {
  --color-grimoire-bg:          #1a1510;  /* page floor — all screens */
  --color-grimoire-surface:     #211c17;  /* raised panels, sidebar equiv */
  --color-grimoire-raised:      #2a2318;  /* cards within panels */

  --color-grimoire-text:        #e8d5b0;  /* parchment — narrative body */
  --color-grimoire-muted:       #8a7660;  /* labels, secondary stats, chrome */

  --color-grimoire-accent:      #c8922a;  /* amber gold — primary accent */
  --color-grimoire-accent-dim:  #7a5418;  /* gutter borders, divider glyphs */

  --color-grimoire-combat:      #1f0a0a;  /* combat panel, danger tint */
}
```

**Nuxt UI primary override** scoped to `.play-page` so auth/setup keep default blue if ever needed:
```css
.play-page {
  --ui-color-primary: var(--color-grimoire-accent);
}
```

**Global body background** in `app.vue`:
```html
<u-app class="bg-grimoire-bg min-h-screen">
```
All `bg-gray-950` instances across every page are replaced — they're now redundant since the body is already the right colour, but explicit overrides remain for surfaces that need the raised treatment.

### Play view: book header replaces the sidebar entirely

The `CharacterSidebar` component is removed. The `w-56` sidebar column is gone. The play layout becomes:

```
┌─────────────────────────────────────────────────────┐
│  PlayHeader (location · scene · date · nav icons)   │
├────────────┬────────────────────────────────────────┤
│ CombatPanel│   Transcript (max-w-2xl centered)      │
│ (combat    │                                        │
│  only)     │   [DM narrative blocks]                │
│            │   [ornamental dividers]                │
│            │   [player annotations]                 │
│            │                                        │
│            ├────────────────────────────────────────┤
│            │   Input area (borderless logbook)      │
└────────────┴────────────────────────────────────────┘
```

**`PlayHeader` component** (`apps/web/components/session/PlayHeader.vue`):

Left cluster:
- Location name in `font-['IM_Fell_English',serif] text-lg text-grimoire-text` — the dominant element. Reads as a chapter setting. Requires the current location name from GraphQL (see Data note below).
- Scene type below it in `font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted` — `EXPLORATION`, `COMBAT`, `SOCIAL`, etc.

Right cluster:
- In-game date in Cinzel muted — `"14th of Harvestmoon"`
- HP as a slim progress bar: `h-1 w-16 bg-grimoire-raised rounded-full` with an inner fill that transitions amber → orange → red. No number label in the header — just the colour signal.
- Navigation icons (character sheet, quests) as `u-icon` links — no text labels

Separator: a `border-b border-grimoire-accent-dim/20` hairline below the header.

**Data note**: The play page GraphQL query must include the current location name. The `GameSession` likely has a `currentLocation` relation. If not exposed in the current session query, a minor query extension is needed — this is the one read-only data fetch addition, no schema change required if the relation already exists on the entity.

### Transcript: manuscript prose column

The `flex-1` main area renders the transcript in a centered, width-constrained column:

```html
<div class="flex-1 overflow-y-auto">
  <div class="max-w-2xl mx-auto px-8 py-8">
    <session-transcript-view ... />
  </div>
</div>
```

`max-w-2xl` (672px) — approximately 65–70 characters per line at 18px. This is the standard comfortable reading width for long-form prose. On very wide screens the extra space becomes negative space; the manuscript sits in the centre of the grimoire page.

### TranscriptView: logbook prose layout

Remove all bubble markup. Replace with a flat reading stack.

**DM narrative block:**
```html
<div
  class="border-l-2 border-grimoire-accent-dim pl-5 py-0.5 my-5 grimoire-entry"
  :class="{ 'first-dm-narrative': isFirstDmEvent, 'grimoire-entry': isNew }"
>
  <div
    class="prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text"
    v-html="parseMarkdown(narrative)"
  />
</div>
```

**Player input annotation:**
```html
<p class="text-sm italic text-grimoire-muted ml-6 mb-5">
  <span class="not-italic font-['Cinzel',serif] tracking-widest text-xs text-grimoire-accent-dim mr-2 uppercase">
    {{ characterName }}
  </span>
  {{ inputText }}
</p>
```

`characterName` is passed as a prop from `play.vue` (already loaded there). The character's actual name — "Aldric says, quietly:" — is more immersive than a generic "You:" label.

**Inner monologue annotation** (the `innerVoiceText` stream):
```html
<div class="ml-6 my-3 pl-3 border-l border-grimoire-surface">
  <p class="text-xs italic text-grimoire-muted/70 leading-relaxed">
    <span class="not-italic text-grimoire-accent-dim/50 mr-1">⟨</span>
    {{ innerVoiceText }}
    <span class="not-italic text-grimoire-accent-dim/50 ml-1">⟩</span>
  </p>
</div>
```
Styled as a marginal annotation in a faint hand — smaller, inset, bordered by a hairline. The `⟨ ⟩` angle brackets signal "aside" without labelling it "inner voice". This reads as the world's hidden texture.

**Ornamental divider** between player-input/DM-narrative pairs:
```html
<!-- OrnamentalDivider.vue -->
<div class="text-center text-grimoire-accent-dim/40 text-xs select-none my-6 tracking-[0.4em]" aria-hidden="true">
  ───── ✦ ─────
</div>
```

**Drop cap** on first DM narrative only:
```css
.first-dm-narrative .prose > p:first-child::first-letter {
  font-family: 'IM Fell English', serif;
  font-size: 4.5em;
  line-height: 0.75;
  float: left;
  margin: 0.05em 0.12em -0.05em 0;
  color: var(--color-grimoire-accent);
  text-shadow: 0 0 20px color-mix(in srgb, var(--color-grimoire-accent) 40%, transparent);
}
```

### Suggested actions: narrative prompts, not chips

Suggested actions arrive one-by-one via the DM stream (`chunk.action` fields) and currently render as `UButton soft` pill chips above the input. In the grimoire context pill buttons are the wrong register entirely.

Replace with a single line of inline italic IM Fell English fragments, each a clickable `<button>`, separated by `·` glyphs:

```html
<div v-if="suggestedActions.length" class="px-8 pb-2">
  <div class="max-w-2xl mx-auto">
    <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted/60 leading-relaxed">
      <template v-for="(action, i) in suggestedActions" :key="action">
        <button
          class="hover:text-grimoire-text transition-colors duration-150"
          @click="handleSuggestedAction(action)"
        >{{ action }}</button><span
          v-if="i < suggestedActions.length - 1"
          class="mx-2 text-grimoire-accent-dim/40 not-italic select-none"
        >·</span>
      </template>
    </p>
  </div>
</div>
```

Renders as: *Investigate the noise · Draw your sword · Call out into the darkness*

Each suggestion is muted (`text-grimoire-muted/60`) by default; hovering a specific path brings it to full `text-grimoire-text`. The `·` separator uses `text-grimoire-accent-dim/40` — the same amber-dim token used in `OrnamentalDivider`, keeping the decorative vocabulary consistent.

The incremental stream appearance (each suggestion appended as it arrives) is preserved and works naturally — no special animation needed. The line grows word by word, which reads as the DM considering options.

Cleared on player submit (`suggestedActions.value = []`) — same as current behaviour.

### Borderless logbook input

The input area sits below the transcript separated by a hairline. No box border by default.

```html
<div class="border-t border-grimoire-accent-dim/20 px-8 py-5 bg-grimoire-bg">
  <div class="max-w-2xl mx-auto">
    <textarea
      v-model="inputText"
      class="w-full bg-transparent text-grimoire-text text-[1.125rem]
             font-['IM_Fell_English',serif] resize-none outline-none
             border-l-2 border-transparent pl-5
             placeholder:italic placeholder:text-grimoire-muted/50
             focus:border-grimoire-accent transition-colors duration-200"
      placeholder="What do you do, adventurer?"
      rows="2"
    />
    <div class="flex justify-end mt-2">
      <button class="font-['Cinzel',serif] text-xs tracking-widest uppercase
                     text-grimoire-accent/60 hover:text-grimoire-accent
                     transition-colors duration-150">
        Act ↵
      </button>
    </div>
  </div>
</div>
```

On focus, the `border-l-2 border-transparent` becomes `border-grimoire-accent` — the same amber gutter as DM narrative blocks appears on the player's writing. The act of typing draws you into the same register as the story. The background lifts slightly to `bg-grimoire-surface` on focus via a transition.

The submit button is Cinzel `ACT ↵` in amber — minimal, not a UButton with a filled background.

### Streaming indicator: breathing amber dot

```css
@keyframes grimoire-breathe {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50%       { opacity: 1;    transform: scale(1.2); }
}
.grimoire-breathe { animation: grimoire-breathe 2.4s ease-in-out infinite; }
```

```html
<div class="flex items-center gap-2 text-xs text-grimoire-muted mt-3 ml-6
            font-['Cinzel',serif] tracking-widest uppercase">
  <span class="w-2 h-2 rounded-full bg-grimoire-accent grimoire-breathe" />
  The DM writes
</div>
```

2.4s pacing matches a resting respiratory rate — alive, not mechanical.

### Entry animation: reveal on new events only

```css
@keyframes grimoire-reveal {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
.grimoire-entry { animation: grimoire-reveal 0.5s ease-out forwards; }
```

Applied only to events appended after mount. In TranscriptView, track a `mounted` ref; set it in `onMounted`. Only apply `.grimoire-entry` when `mounted.value === true`. Historical events render without animation.

### Background: noise texture + combat tint

```css
.grimoire-bg {
  position: relative;
  background-color: var(--color-grimoire-bg);
  transition: background-color 0.8s ease;
}
.grimoire-bg.is-combat {
  background-color: color-mix(in srgb, var(--color-grimoire-bg) 82%, var(--color-grimoire-combat) 18%);
}
.grimoire-bg::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px 200px;
}
```

All direct children above the texture need `position: relative; z-index: 1`.

The combat tint transitions over 0.8s — the page floor darkens toward danger-red before the player reads anything.

### HP bar: amber → orange → blood-red breathing

```
> 50%  →  bg-grimoire-accent  +  box-shadow: 0 0 8px color-mix(in srgb, #c8922a 50%, transparent)
> 25%  →  bg-orange-600
≤ 25%  →  bg-red-700  +  animation: grimoire-breathe 1.2s ease-in-out infinite  (double speed)
```

Applied in both `PlayHeader.vue` (slim bar) and `CombatPanel.vue` (combatant bars). The `CharacterSidebar.vue` component is removed entirely.

### CombatPanel: danger atmosphere

Background: `bg-grimoire-combat`.

Radial vignette via `::after`:
```css
.grimoire-combat-panel {
  position: relative;
}
.grimoire-combat-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%);
  z-index: 0;
}
```

Active-turn combatant: `bg-grimoire-accent/10 ring-1 ring-grimoire-accent/40` — amber glow, not blue.

Section labels in Cinzel (`font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted`).

### Loading states: maintain the fiction

Play page loading:
```html
<div class="flex flex-col items-center justify-center gap-4 text-grimoire-muted">
  <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
  <p class="font-['IM_Fell_English',serif] italic text-lg">The grimoire stirs...</p>
</div>
```

Replace every `<u-icon name="i-lucide-loader-circle" class="animate-spin" />` + generic text with the breathing amber dot and an IM Fell English phrase appropriate to the context. Character sheet: "Reading the chronicle...". Quests: "Consulting the scroll...".

### Campaign end screen: epitaph moment

The current screen is cold and generic. This is the most emotionally significant moment in the game.

Full-screen grimoire background (already set globally). Layout:

1. **Slow fade-in sequence** — the entire screen fades in over 1.5s on mount via `@keyframes grimoire-fade { from { opacity: 0 } to { opacity: 1 } }` with `animation: grimoire-fade 1.5s ease forwards`.

2. **"In Memoriam"** — Cinzel, `text-xs tracking-[0.5em] uppercase text-grimoire-muted` at the top. No icon. The skull is replaced with silence.

3. **Character name** — IM Fell English, large (`text-4xl`), `text-grimoire-text`. This is the character's tombstone.

4. **Epitaph** — IM Fell English italic, `text-xl leading-loose text-grimoire-text/80`, no border/card wrapper. The text floats on the dark page — a passage in a book, not a UI element.

5. **Stats** — Two numbers in `font-mono text-5xl text-grimoire-accent` with Cinzel labels below. `font-mono` for the numbers only — precision; the labels in Cinzel `tracking-widest uppercase text-grimoire-muted text-xs`.

6. **Amber hairline** separating stats from the action button.

7. **"Begin anew"** button — not `u-button` with default styling. A Cinzel text link with an amber underline: `font-['Cinzel',serif] tracking-widest uppercase text-grimoire-accent text-sm`.

### Auth page: grimoire cover

Replace the two `UCard` login/register stack with a single atmospheric page:

1. **Background**: the global `bg-grimoire-bg` with the noise texture (already set on body).

2. **Wordmark/title** — centred at the top: a large IM Fell English title (the app name or "Chronicle" or similar — whatever the app calls itself) in `text-5xl text-grimoire-text`, with a Cinzel subtitle in `text-xs tracking-[0.4em] uppercase text-grimoire-muted`.

3. **Form area** — not a `UCard`. A borderless form column, centred, `max-w-sm`. Field labels in Cinzel. `UInput` components inherit the grimoire primary override (amber focus ring). The `UButton` submit button gets `bg-grimoire-accent text-grimoire-bg` — solid amber, Cinzel label.

4. **Login/Register toggle** — a simple Cinzel text link below the form, no second card.

5. **Error alerts** — `UAlert` with `color="error"` will show red; acceptable. The form fields themselves stay as `UInput` for accessibility.

### Character sheet: manuscript layout

Replace `UCard` section containers with grimoire-native sections.

- **Page background**: `bg-grimoire-bg` (inherits from body)
- **Navigation**: Cinzel `text-xs tracking-widest uppercase text-grimoire-muted`, active link in amber
- **Character name**: IM Fell English `text-4xl text-grimoire-text`
- **Race/Class/Level**: Cinzel `text-sm tracking-wider text-grimoire-muted uppercase`
- **Section headings** ("Core Stats", "Abilities", "Equipment" etc.): Cinzel `text-xs tracking-[0.4em] uppercase text-grimoire-muted` with a `border-b border-grimoire-accent-dim/30` hairline below
- **Stat blocks** (HP, AC, etc.): `font-mono text-2xl text-grimoire-accent` for the number, Cinzel label below — embossed feel
- **Ability scores**: small `bg-grimoire-surface rounded` containers with mono score and Cinzel abbreviation label — replaces the generic grid

### Quest log: scroll-and-seal layout

- **Page background** inherits from body
- **Navigation**: same Cinzel pattern as character sheet
- **"Quests"** heading: IM Fell English `text-3xl text-grimoire-text`
- **Quest cards**: `bg-grimoire-surface border border-grimoire-accent-dim/20 rounded-sm` — replace `UCard bg-gray-900 border-gray-700`. The `rounded-sm` (not `rounded-lg`) suits the manuscript aesthetic — less bubbly
- **Quest title**: IM Fell English `text-base text-grimoire-text`
- **Quest description**: IM Fell English `text-sm leading-relaxed text-grimoire-text/80`
- **Active badge**: `font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent border border-grimoire-accent-dim/50 px-2 py-0.5 rounded-sm` — not `UBadge` default
- **Completed quests**: lower opacity (`opacity-60`) with a hairline `line-through` on the title — faded but legible, like a crossed-out logbook entry
- **Empty state**: IM Fell English italic `text-grimoire-muted` — "No quests yet. The road ahead is unwritten." No dashed border box.
- **Objective checkboxes**: `text-grimoire-accent` for completed (`✦`), `text-grimoire-muted` for pending (`◦`) — no `UCheckbox`

### Setup wizard: atmospheric ritual, not a form

The setup wizard has 7 steps across two phases. Currently every step is a `UCard` with `text-xl font-semibold` headers. The redesign treats each step as a narrative act — the player is not filling out a configuration form, they are making choices that will shape a living world.

**Layout frame** — same grimoire background. No `UCard`. A `max-w-xl mx-auto` column centred on the page. Each step is a free-standing section without a card border.

**Progress indicator** — replace the numbered `bg-primary-500` circles with a minimal Cinzel step list:
```html
<div class="flex items-center gap-0 mb-12">
  <span v-for="(label, i) in wizardStepLabels" :key="i" class="flex items-center">
    <span
      class="font-['Cinzel',serif] text-xs tracking-widest uppercase transition-colors"
      :class="i === wizardStepIndex
        ? 'text-grimoire-accent border-b border-grimoire-accent pb-0.5'
        : i < wizardStepIndex
          ? 'text-grimoire-muted/50'
          : 'text-grimoire-muted/30'"
    >{{ label }}</span>
    <span v-if="i < wizardStepLabels.length - 1"
      class="mx-3 text-grimoire-accent-dim/30 text-xs">·</span>
  </span>
</div>
```
No circles, no connecting lines. Just Cinzel labels — current step underlined in amber, past steps faded, future steps near-invisible.

**Step headings** — renamed from generic to narrative:

| Step | Current | Renamed |
|---|---|---|
| charName | "Name your character" | "Name your hero" |
| charRace | "Choose a race" | "Choose your lineage" |
| charClass | "Choose a class" | "Choose your calling" |
| charAbilities | "Assign ability scores" | "Your gifts and shortcomings" |
| tone | "Set the stage" | "The shape of your story" |
| concepts | "Choose your story" | "Three tales await" |
| worldGen | "Generate your world" | "Forge the world" |

All step headings in IM Fell English `text-3xl text-grimoire-text`. The sub-description line in Cinzel `text-xs tracking-wider uppercase text-grimoire-muted`.

**Character name input** — borderless logbook approach. IM Fell English `text-xl`, amber left border on focus, placeholder `"What is your name, adventurer?"`. Same treatment as the play input.

**Race and class selection cards** — `bg-grimoire-surface border border-grimoire-accent-dim/20 rounded-sm` replacing `bg-gray-900 border-gray-700 rounded-lg`. Selected: `border-grimoire-accent bg-grimoire-accent/8`. Race/class name in IM Fell English `text-base text-grimoire-text`. Trait/details in Cinzel `text-xs tracking-wider text-grimoire-muted`. The `rounded-sm` (not `rounded-lg`) suits the manuscript aesthetic — less bubble, more parchment card.

**Ability score assignment** — the most mechanical step; keep it legible but grimoire-consistent:
- Standard array chips: `bg-grimoire-surface border border-grimoire-accent-dim/30 font-mono text-grimoire-text px-3 py-1 rounded-sm`. Available in amber, used = `opacity-40 line-through text-grimoire-muted`.
- Assignment buttons: `w-12 h-12 font-mono border border-grimoire-accent-dim/20 bg-grimoire-surface text-grimoire-text rounded-sm`. Selected: `bg-grimoire-accent border-grimoire-accent text-grimoire-bg font-bold`.
- Ability row labels (STR, DEX etc.): Cinzel `text-xs tracking-widest uppercase text-grimoire-muted w-12`.
- The section divider between chips and rows: `border-t border-grimoire-accent-dim/20`.

**Tone selection** — six options in a `grid-cols-2 sm:grid-cols-3 gap-3`. Same grimoire card treatment as race/class. The tone name in IM Fell English `text-base`. The description smaller below. No icon — the names carry enough weight at this visual register.

**Death mode selection** — same grid, same treatment. `PERMADEATH` card gets `hover:border-red-900/50 hover:bg-grimoire-combat/20` — a subtle danger signal on hover. The selection state for PERMADEATH uses a slightly warmer selected background: `bg-red-950/30 border-red-800/50` instead of amber. This is the one place where the grimoire deviates from amber to signal "this choice has permanent consequences."

**Concept selection** — the most important step. Three story concepts with `premise`, `centralConflict`, and `antagonistHint`. Currently labeled "Concept 1". Redesign:

```html
<div
  v-for="(concept, i) in concepts"
  class="p-6 border rounded-sm cursor-pointer transition-all duration-200 space-y-3"
  :class="selectedConceptIndex === i
    ? 'border-grimoire-accent bg-grimoire-accent/5'
    : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50'"
  @click="selectedConceptIndex = i"
>
  <!-- Roman numeral -->
  <span class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-accent-dim">
    {{ ['I', 'II', 'III'][i] }}
  </span>

  <!-- Premise — the hook -->
  <p class="font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text">
    {{ concept.premise }}
  </p>

  <!-- Central conflict — small Cinzel label + IM Fell English text -->
  <div>
    <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mr-2">Conflict</span>
    <span class="font-['IM_Fell_English',serif] text-sm text-grimoire-text/80">{{ concept.centralConflict }}</span>
  </div>

  <!-- Antagonist hint — italic, as a mysterious closing line -->
  <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted border-t border-grimoire-accent-dim/20 pt-3 mt-1">
    {{ concept.antagonistHint }}
  </p>
</div>
```

Each concept reads as a story fragment rather than a configuration option. The Roman numeral (I, II, III) in faded amber Cinzel is the only labeling — no "Concept 1" text.

**World generation step** — the prose description replaces the icon bullet list:

```html
<div class="space-y-4">
  <p class="font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text">
    The DM will breathe life into your world — carving out locations, seeding factions with
    hidden agendas, placing NPCs into motion, and setting the antagonist's first moves
    before you draw your first breath.
  </p>
  <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted">
    This may take a moment. The world does not form lightly.
  </p>
</div>
```

The generation button becomes a Cinzel label: `"Forge the world"`. While `submitting`:
```html
<div class="flex flex-col items-center gap-4 py-8">
  <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
  <p class="font-['IM_Fell_English',serif] italic text-lg text-grimoire-muted">
    The world takes shape...
  </p>
</div>
```
The entire button area is replaced by this state — no disabled button with a spinner inside.

**"Campaign ready" state** — replace the green `i-lucide-check-circle` with:
```html
<div class="text-center space-y-6">
  <p class="font-['Cinzel',serif] text-xs tracking-[0.5em] uppercase text-grimoire-muted">
    Your chronicle awaits
  </p>
  <h2 class="font-['IM_Fell_English',serif] text-4xl text-grimoire-text">
    The world is ready.
  </h2>
  <button class="font-['Cinzel',serif] text-sm tracking-widest uppercase text-grimoire-accent
                 border-b border-grimoire-accent pb-0.5 hover:text-grimoire-text transition-colors">
    Begin your story →
  </button>
</div>
```

No icon. No `UButton`. The underlined Cinzel text link is the right register for this moment.

**Navigation between steps** — replace `UButton variant="ghost"` back buttons with Cinzel text: `← Back` in `text-grimoire-muted hover:text-grimoire-text`. The forward button for most steps is a full-width `bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif] tracking-widest uppercase` button — the one surface where we use a filled amber button to signal "commit and advance."

## Risks / Trade-offs

**`CharacterSidebar.vue` deletion** → The component is removed entirely. Any other file importing it would break. Audit: only `play.vue` imports it. Safe to delete after updating `play.vue`.

**Current location in play header requires data** → The `activeSession` query in `play.vue` must expose `currentLocation.name`. If `GameSession.currentLocation` is already a loaded relation, it may just need adding to the GraphQL fragment. If not exposed at all, a minor resolver field addition is needed — no schema migration, no breaking change.

**IM Fell English 18px on long sessions** → At 18px with `max-w-2xl` (~65 chars/line) and `leading-relaxed`, a session transcript of 50+ exchanges will be very long. This is correct — it should feel like reading a book. Scroll behaviour must be smooth; `overflow-y: auto` with `scroll-behavior: smooth` on the transcript container.

**Removing `UCard` from character/quests** → Nuxt UI `UCard` provides some slot structure. Replacing it means replicating the padding/layout manually — low risk, but must be done per-section rather than globally to avoid unintended regressions in other routes still using `UCard`.

**Auth page title** — the wordmark needs a decision on what the app is called. Placeholder `"Grimoire"` can be used if this is undecided; can be updated independently.

**Cinzel synthetic bold** → Cinzel ships in regular weight only. Never apply `font-bold` to Cinzel text — it will produce synthetic bold which looks wrong at small sizes. All Cinzel usage is uppercase with wide tracking; the letterforms carry weight without bold.

**`grimoire-reveal` on history replay** → The `mounted` ref guard is essential. Without it, resuming a 60-event session will cascade-animate every event on load. The guard is simple but must not be forgotten.

**Nuxt UI component styling** → `UInput`, `UButton`, `UAlert`, `UBadge` used throughout. The primary colour override handles most cases. Where the defaults diverge from the grimoire aesthetic (UCard borders, UBadge pill radius), replace with plain HTML+CSS rather than fighting the component's design.

## Migration Plan

1. Install `@fontsource/im-fell-english` and `@fontsource/cinzel`; register in `nuxt.config.ts`
2. Rewrite `main.css`: add `@theme` tokens, all keyframes (`grimoire-reveal`, `grimoire-breathe`, `grimoire-fade`), drop-cap rule, `.grimoire-bg` texture pseudo-element, `.play-page` primary override, `.grimoire-separator`, `.grimoire-combat-panel::after` vignette, `.prose-grimoire` modifier
3. Update `app.vue`: `bg-grimoire-bg` on the root element
4. Rewrite `auth.vue`: wordmark, borderless form, Cinzel labels, amber submit button
5. Create `PlayHeader.vue`: location, scene, date, HP strip, nav icons
6. Update `play.vue`: remove sidebar import and column; add `PlayHeader`; add `grimoire-bg play-page is-combat` classes; update input area to borderless logbook; update streaming indicator; update loading state
7. Rewrite `TranscriptView.vue`: prose layout, character name annotation, inner monologue margin note, `OrnamentalDivider`, drop-cap guard, `grimoire-entry` mounted guard
8. Create `OrnamentalDivider.vue`
9. Delete `CharacterSidebar.vue`
10. Update `CombatPanel.vue`: grimoire-combat background, vignette, amber active turn, Cinzel labels, HP colours
11. Rewrite `CampaignEndScreen.vue`: slow fade, no skull, IM Fell English epitaph, mono stats, Cinzel labels, text "begin anew" link
12. Update `character.vue`: remove UCard sections, manuscript layout, Cinzel nav + headings, IM Fell English name, mono stat numbers
13. Update `quests.vue`: grimoire-surface quest cards, IM Fell English text, Cinzel badge, custom objective markers, empty state prose
14. Rewrite `setup.vue`: Cinzel progress indicator, IM Fell English step headings, borderless name input, grimoire-surface selection cards, concept cards with Roman numerals and story layout, PERMADEATH danger treatment, prose world-gen step with breathing indicator, Cinzel "The world is ready" ready state

No database migrations. No API changes (one possible minor GraphQL fragment extension for current location). Rollback is a git revert.

## Open Questions

- **App title / wordmark on auth page**: needs a name. Use `"Grimoire"` as placeholder until decided.
- **Current location GraphQL availability**: verify whether `activeSession.currentLocation.name` is already in the session query or needs a fragment update. Read `apps/web/graphql/session.ts` before implementing `PlayHeader.vue`.
- **Character sheet name field on epitaph**: the `CampaignEndScreen` currently receives `epitaph`, `daysPlayed`, and `questsCompleted` as props but not the character name. A `characterName` prop addition is trivial — include it.
- **`grimoire-reveal` animation budget**: on sessions with 100+ events, skip all animations on mount; only animate events appended live. The `mounted` guard handles this.
