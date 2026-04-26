# Dark Grimoire — UI Design System

The web app uses a bespoke design language called **Dark Grimoire**: the aesthetic of an ancient tome read by candlelight. Warm ink on aged parchment, gold leaf ornament, and a sense of weight and age. Every element should feel like it belongs inside a hand-bound book of forbidden lore.

---

## Colour Palette

All colours are defined as CSS custom properties in `apps/web/assets/css/main.css` under `@theme`.

| Token | Hex | Role |
|---|---|---|
| `--color-grimoire-bg` | `#1a1510` | Page background — near-black warm brown |
| `--color-grimoire-surface` | `#211c17` | Cards, panels, raised containers |
| `--color-grimoire-raised` | `#2a2318` | Tertiary surface, hover targets |
| `--color-grimoire-text` | `#e8d5b0` | Primary text — aged parchment |
| `--color-grimoire-muted` | `#8a7660` | Secondary text, labels, placeholders |
| `--color-grimoire-accent` | `#c8922a` | Gold leaf — interactive elements, borders, focus rings |
| `--color-grimoire-accent-dim` | `#7a5418` | Dimmed gold — decorative borders, dividers |
| `--color-grimoire-combat` | `#1f0a0a` | Deep crimson tint mixed in during combat |

**Usage rules:**
- Use `grimoire-accent` sparingly — it is the single point of colour that draws the eye. Reserve it for interactive affordances, ornamental SVG, and the active-state of controls.
- Borders almost always use `grimoire-accent-dim` at reduced opacity (`/20` – `/40`) to avoid visual weight.
- Never use pure black (`#000`) or pure white (`#fff`). The warmth of the palette is integral.

In Tailwind / Nuxt UI, these tokens are available as utility classes:
- `bg-grimoire-bg`, `text-grimoire-text`, `border-grimoire-accent-dim`, etc.

---

## Typography

Two typefaces are loaded via `@fontsource` in `nuxt.config.ts`:

| Font | Weight/Style | Tailwind class | Usage |
|---|---|---|---|
| **IM Fell English** | 400, 400-italic | `font-['IM_Fell_English',serif]` | Narrative prose, UI copy with literary character, placeholder text |
| **Cinzel** | 400 | `font-['Cinzel',serif]` | Labels, stat readouts, button text, anything uppercase + tracked |
| System mono | — | `font-mono` | Numeric values (HP counts, dice rolls) |

**Typography rules:**
- Narrative prose (DM output, inner monologue): IM Fell English, `text-[1.125rem]`, `leading-relaxed`.
- UI labels and chrome: Cinzel, `text-xs`, `tracking-widest`, `uppercase`.
- IM Fell English italic is the "voice" of the world. Use it for flavour text, placeholders, streaming indicators.
- Cinzel is the "authority" font. Use it for structural labels the player interacts with.
- Never mix the two fonts in the same inline run.

### Drop Cap

The first letter of the first DM narrative block in a session receives a decorative drop cap:

```css
.first-dm-narrative .prose > p:first-child::first-letter {
    font-family: 'IM Fell English', serif;
    font-size: 4.5em;
    line-height: 0.75;
    float: left;
    color: var(--color-grimoire-accent);
    text-shadow: 0 0 20px color-mix(in srgb, var(--color-grimoire-accent) 40%, transparent);
}
```

Apply `.first-dm-narrative` to the wrapper of the first narrative event. Do not apply it to subsequent narrative blocks.

---

## Prose Styles

Narrative text is rendered as HTML via `prose-grimoire`, which overrides the Tailwind Typography defaults:

```html
<div class="prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed">
```

The `prose-grimoire` modifier remaps all `--tw-prose-*` variables to grimoire colour tokens. See `main.css` for the full mapping.

### Ornamental `<hr>`

Inside `.prose-grimoire`, `<hr>` elements are replaced with a centred `✦` glyph flanked by fading gradient rules (no visible `<hr>` border). The glyph and rules are rendered via `::before` / `::after` pseudo-elements.

---

## Background & Texture

The `.grimoire-bg` class sets the page background and adds a full-viewport noise overlay via `::before`:

```html
<div class="grimoire-bg">
```

The overlay is an inline SVG `feTurbulence` filter at 7% opacity, creating subtle parchment grain. It is `position: fixed` and `pointer-events: none` so it never interferes with layout.

### Combat Mode

When the scene type is `COMBAT`, add `.is-combat` to the `.grimoire-bg` root:

```html
<div class="grimoire-bg" :class="{ 'is-combat': isCombat }">
```

This blends `--color-grimoire-combat` (deep crimson) into the background at 18% using `color-mix`, with an 800ms ease transition.

---

## Animations

All keyframes are defined in `main.css` under the `/* ── Keyframes ──` section.

| Utility class | Keyframe | Description |
|---|---|---|
| `.grimoire-entry` | `grimoire-reveal` | Element fades in and rises 5 px. Used on newly-appended transcript blocks. |
| `.grimoire-breathe` | `grimoire-breathe` | Pulsing scale + opacity. Used on the loading orb and low-HP bar. |
| `.grimoire-cursor-blink` | `grimoire-cursor` | Blinking `_` cursor for the streaming indicator. |
| `.grimoire-page-enter` | `grimoire-reveal` | Same animation at 450ms — apply to full-page content on mount. |
| `.grimoire-stagger` | `grimoire-reveal` | Applies staggered delays (100–700ms) to the first 5 direct children. |

**Rules:**
- Apply `.grimoire-entry` only after the component has mounted (guard with a `mounted` ref) to avoid animating SSR-rendered content.
- `.grimoire-breathe` is the danger signal. Use it only for the loading state and the critical-HP bar — overuse dilutes its urgency.
- Do not add custom `animation` properties outside these classes. Use the defined keyframes for consistency.

---

## Ornamental Components

### `OrnamentalDivider`

An SVG divider (`components/session/OrnamentalDivider.vue`) rendered between a player input and the following DM narrative:

```
── ◇ ✦ ◇ ──
```

Two horizontal rules flank a star glyph (filled) with diamond outlines on either side. The SVG is 180 × 18 px, drawn in `grimoire-accent` / `grimoire-accent-dim` at 35% opacity.

Use `<session-ornamental-divider />` whenever a new DM response follows a player action.

### Inner Monologue Brackets

`.inner-monologue` wraps the character's in-progress thought stream. The `::before` / `::after` pseudo-elements on the first and last `<p>` inject `⟨ ` and ` ⟩` in `grimoire-accent-dim`:

```html
<div class="inner-monologue border-l-2 border-grimoire-accent-dim/40 bg-grimoire-surface/40 rounded-r pl-4 py-2">
```

---

## Layout

The play screen is a fixed-height flex column (`h-screen flex flex-col overflow-hidden`):

```
┌─────────────────────────────────────┐
│ PlayHeader (border-b, bg/80 blur)   │
├──────────┬──────────────────────────┤
│ Combat   │  Transcript (flex-1,     │
│ Panel    │  overflow-y-auto)        │
│ (slides  ├──────────────────────────┤
│ in from  │  Suggested actions       │
│ left)    ├──────────────────────────┤
│          │  Streaming indicator     │
│          ├──────────────────────────┤
│          │  Input area (border-t)   │
└──────────┴──────────────────────────┘
```

- The combat panel enters/leaves with a `transition-all duration-300` slide from the left edge.
- Modal overlays (Level Up, Spell Prep) sit at `z-20` with `bg-grimoire-bg/90 backdrop-blur-sm`.
- All content columns cap at `max-w-2xl mx-auto px-8` for readable line lengths.

### PlayHeader

- `border-b border-grimoire-accent-dim/20`, `bg-grimoire-bg/80` (semi-transparent backdrop).
- Left side: location name (IM Fell English lg) + scene type (Cinzel xs uppercase).
- Right side: in-game date (Cinzel xs), HP strip, nav icons.

### HP Bar

A `h-1.5 w-20` pill bar. The fill colour transitions between states:

| HP % | Class |
|---|---|
| > 50% | `bg-grimoire-accent` |
| 26–50% | `bg-orange-600` |
| ≤ 25% | `bg-red-700 grimoire-breathe` |

### Input Area

```html
<textarea class="bg-transparent font-['IM_Fell_English',serif] border-l-2 border-transparent
                 focus:border-grimoire-accent transition-colors duration-200 pl-5" />
```

The left-border focus affordance (transparent → `grimoire-accent`) is the only interactive feedback — no box-shadow, no background change. Keep it subtle.

The submit button is Cinzel xs tracking-widest: `Act ↵`. Disabled at 30% opacity.

---

## Component Conventions

| Context | Pattern |
|---|---|
| Narrative block | `border-l-2 border-grimoire-accent-dim pl-5 py-0.5` |
| Player input annotation | Small italic `text-grimoire-muted`, name label in Cinzel `text-grimoire-accent-dim` |
| Cards / modal panels | `bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-6` |
| Primary buttons | `bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif] tracking-widest uppercase rounded-sm` |
| Toggle (active) | `bg-grimoire-accent text-grimoire-bg border-grimoire-accent` |
| Toggle (inactive) | `text-grimoire-muted border-grimoire-accent-dim/30` |
| Section labels | Cinzel xs `uppercase tracking-wider text-grimoire-muted` |
| Flavour / instructional text | IM Fell English sm italic `text-grimoire-muted/70` |
| Dot separator in inline lists | `text-grimoire-accent-dim/40 not-italic select-none` — character `·` |

---

## Nuxt UI Integration

`nuxt.config.ts` sets `neutral: 'stone'` to align Nuxt UI's neutral scale with the warm stone palette.

On `.play-page` and `.grimoire-ui` scoped contexts, `--ui-color-primary` is overridden to `--color-grimoire-accent`, so Nuxt UI components (`UInput`, `UAlert`, `UIcon`, etc.) automatically adopt the gold accent.

Global `--ui-*` tokens in `:root` map the grimoire surface/text/border colours into the Nuxt UI system, so unstyled UI components inherit the grimoire palette automatically.

---

## Dos and Don'ts

**Do:**
- Use `rounded-sm` (not `rounded` or `rounded-lg`) — the aesthetic is angular and structured.
- Prefer `opacity` modifiers (e.g. `/20`, `/40`) over separate colour values for borders and overlays.
- Keep motion subtle — `0.3–0.5s ease-out` is the house tempo.
- Use `color-mix()` for dynamic tinting (combat background, accent glow effects).

**Don't:**
- Use `rounded-full` on rectangular containers. Pills are only for the HP bar and dot indicators.
- Use blue, purple, or green as accent colours. The palette is monochromatic warm — `grimoire-accent` (gold) is the only colour.
- Add shadows with `box-shadow`. Use gradient backgrounds or vignettes for depth instead.
- Use `font-bold` on Cinzel or IM Fell English — these fonts have no bold weight in the loaded subset. Use letter-spacing and sizing for hierarchy.
