## Why

The play interface is visually indistinguishable from a generic dark-mode SaaS chat app. It uses cold gray backgrounds, messaging-app bubble layout, system fonts, and a generic blue primary colour. None of this communicates that the player is in a living D&D world narrated by an ancient intelligence. The interface should feel like a grimoire — warm, textured, literary — and every visual decision should reinforce the high-fantasy tone of the game.

## What Changes

Adopt a **Dark Grimoire** aesthetic across the play interface:

- **Background**: Deep charcoal-brown (`#1a1510`) replacing cold `gray-950`. Subtle noise/grain texture overlay for depth.
- **Typography**: IM Fell English or Crimson Pro (serif) for DM narrative text. Warm parchment colour (`#e8d5b0`) for body text. Existing sans kept for UI chrome (labels, stats, navigation).
- **Accent colour**: Amber/gold (`#c8922a`) replacing the generic `primary` blue. Applied to active states, the streaming indicator, the scene badge, and HP fill when healthy.
- **DM narrative**: Remove chat bubbles entirely. Render as full-width prose paragraphs with generous line-height. Thin amber left border (`border-l-2 border-amber-700/50`) as a gutter marker. First paragraph of a session gets a decorative drop cap.
- **Player input display**: Rendered as a smaller, slightly inset entry below the DM response — logbook style, not a chat bubble. Italic treatment. "You:" label prefix.
- **Scene separators**: Horizontal rule between exchanges replaced with `───── ✦ ─────` style ornamental divider.
- **Sidebar**: Ornate section separators instead of plain `border-gray-800`. HP bar transitions through amber → orange → red at low HP with a subtle glow. Class and race shown prominently near the character name.
- **Combat panel**: Warm red tint on the background (`#1f0a0a`) when in combat — the panel itself signals danger before the player reads anything.
- **Input area**: Textarea styled with a subtle parchment border, amber focus ring. Placeholder text: "What do you do, adventurer?"
- **Streaming indicator**: Quill-and-ink metaphor — a feather icon animating instead of a spinner. Or amber pulsing dot labelled "The DM writes..."

## Capabilities

### New Capabilities

- `grimoire-ui`: Defines the visual identity system for the play interface — colour tokens, typography scale, prose layout rules, sidebar personality, and combat panel treatment.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/web/pages/campaign/[id]/play.vue`, `apps/web/components/session/TranscriptView.vue`, `apps/web/components/session/CharacterSidebar.vue`, `apps/web/components/session/CombatPanel.vue`, `apps/web/app.vue` (font import), `apps/web/tailwind.config.ts` (theme extension).
- Affected systems: play interface only. No API, schema, or database changes.
- Dependencies: Google Fonts or Fontsource package for the chosen serif font. No new JS dependencies expected.
- Sequencing: should be implemented after `markdown-rendering` — the prose typography styles need to be in place before grimoire font/colour rules are layered on top.
