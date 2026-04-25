## 1. Dependencies and Global Tokens

- [ ] 1.1 Add `@fontsource/im-fell-english` and `@fontsource/cinzel` to `apps/web/package.json` via `yarn workspace web add`
- [ ] 1.2 Register font CSS files in `nuxt.config.ts` css array: `@fontsource/im-fell-english/400.css`, `@fontsource/im-fell-english/400-italic.css`, `@fontsource/cinzel/400.css`
- [ ] 1.3 Add `@theme` block to `main.css` with all 8 grimoire colour tokens (`--color-grimoire-bg` through `--color-grimoire-combat`)
- [ ] 1.4 Add `.play-page` scoped Nuxt UI primary override (`--ui-color-primary: var(--color-grimoire-accent)`) to `main.css`
- [ ] 1.5 Add all CSS keyframes to `main.css`: `grimoire-reveal`, `grimoire-breathe`, `grimoire-fade`
- [ ] 1.6 Add `.grimoire-bg` base class and `::before` noise texture pseudo-element to `main.css`
- [ ] 1.7 Add `.grimoire-bg.is-combat` background-color transition rule to `main.css`
- [ ] 1.8 Add `.grimoire-combat-panel::after` radial vignette rule to `main.css`
- [ ] 1.9 Add drop-cap rule `.first-dm-narrative .prose > p:first-child::first-letter` to `main.css`
- [ ] 1.10 Add `.prose-grimoire` modifier overriding `--tw-prose-*` variables with grimoire tokens to `main.css`
- [ ] 1.11 Update `app.vue` root element to apply `bg-grimoire-bg min-h-screen`

## 2. New Shared Components

- [ ] 2.1 Create `apps/web/components/session/OrnamentalDivider.vue` — centred `───── ✦ ─────` text, `aria-hidden`, amber-dim colour, `select-none`
- [ ] 2.2 Create `apps/web/components/session/PlayHeader.vue` — location name (IM Fell English), scene type (Cinzel), in-game date (Cinzel muted), HP strip, nav icons; accept props: `locationName`, `sceneType`, `inGameDate`, `hp`, `maxHp`

## 3. Play Page Layout Restructure

- [ ] 3.1 Verify `activeSession` GraphQL fragment in `apps/web/graphql/session.ts` includes `currentLocation.name`; extend the fragment if missing
- [ ] 3.2 Remove `session-character-sidebar` import and column div from `play.vue`
- [ ] 3.3 Add `<session-play-header>` above the transcript area in `play.vue`, passing `locationName`, `sceneType`, `inGameDate`, `hp`, `maxHp` from loaded data
- [ ] 3.4 Add `grimoire-bg play-page` classes to the `play.vue` root div; bind `:class="{ 'is-combat': isCombat }"`
- [ ] 3.5 Wrap the transcript scroll container in `<div class="flex-1 overflow-y-auto"><div class="max-w-2xl mx-auto px-8 py-8">` to constrain prose column
- [ ] 3.6 Replace suggested action `UButton` chips with inline italic IM Fell English fragments separated by `·` glyphs
- [ ] 3.7 Rewrite the input textarea: remove `UTextarea`/border styling; apply borderless logbook treatment with amber left-border-on-focus, IM Fell English font, italic placeholder `"What do you do, adventurer?"`
- [ ] 3.8 Replace the submit `UButton` with a Cinzel text control (`ACT ↵`)
- [ ] 3.9 Replace the streaming indicator block cursor with the `grimoire-breathe` amber dot + Cinzel "The DM writes" label
- [ ] 3.10 Replace the play page loading spinner with breathing amber dot + IM Fell English italic `"The grimoire stirs..."`

## 4. TranscriptView Refactor

- [ ] 4.1 Remove all `flex justify-end`, `flex justify-start`, `rounded-2xl`, and bubble background classes from `TranscriptView.vue`
- [ ] 4.2 Add `mounted` ref (`const mounted = ref(false); onMounted(() => { mounted.value = true })`); apply `grimoire-entry` class only when `mounted.value === true`
- [ ] 4.3 Render each `DM_NARRATIVE` event as `border-l-2 border-grimoire-accent-dim pl-5 py-0.5 my-5` wrapper containing a `prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem]` div
- [ ] 4.4 Track index of first `DM_NARRATIVE` event; apply `first-dm-narrative` class to that element only
- [ ] 4.5 Render `PLAYER_INPUT` events as italic `text-grimoire-muted` paragraph with character name label in Cinzel amber-dim; accept `characterName` prop
- [ ] 4.6 Add `OrnamentalDivider` between exchanges: render only when a `DM_NARRATIVE` follows a `PLAYER_INPUT` in the event list
- [ ] 4.7 Render `innerVoiceText` as `⟨ text ⟩` in `text-xs italic text-grimoire-muted/70`, inset with a hairline left border
- [ ] 4.8 Add `characterName` prop to `TranscriptView`; pass it from `play.vue`

## 5. Combat Panel

- [ ] 5.1 Replace `bg-gray-900` with `bg-grimoire-combat` on `CombatPanel.vue` root
- [ ] 5.2 Add `grimoire-combat-panel` class to the root for the `::after` vignette
- [ ] 5.3 Replace active-turn highlight `bg-primary-900/40 ring-1 ring-primary-500` with `bg-grimoire-accent/10 ring-1 ring-grimoire-accent/40`
- [ ] 5.4 Replace active-turn dot `bg-primary-400` with `bg-grimoire-accent`
- [ ] 5.5 Update `hpBarColor()` in `CombatPanel.vue`: `> 50%` → amber + glow shadow, `> 25%` → orange, `≤ 25%` → red + fast `grimoire-breathe`
- [ ] 5.6 Update section labels ("Combat", "Actions", "Spell Slots") to Cinzel `text-xs tracking-widest uppercase text-grimoire-muted`
- [ ] 5.7 Replace action economy dot colours: action dot `bg-grimoire-accent`, bonus/reaction dots keep yellow/blue (hardcoded, intentional)
- [ ] 5.8 Delete `apps/web/components/session/CharacterSidebar.vue`

## 6. Campaign End Screen

- [ ] 6.1 Add `characterName` prop to `CampaignEndScreen.vue`; pass it from `play.vue`
- [ ] 6.2 Apply `grimoire-fade` 1.5s fade-in animation to the root element on mount
- [ ] 6.3 Remove `i-lucide-skull` icon
- [ ] 6.4 Add Cinzel `"In Memoriam"` label at top (`text-xs tracking-[0.5em] uppercase text-grimoire-muted`)
- [ ] 6.5 Render character name in IM Fell English `text-4xl text-grimoire-text`
- [ ] 6.6 Render epitaph in IM Fell English italic `text-xl leading-loose text-grimoire-text/80` with no card/border wrapper
- [ ] 6.7 Render `daysPlayed` and `questsCompleted` in `font-mono text-5xl text-grimoire-accent` with Cinzel labels
- [ ] 6.8 Replace `UButton` restart control with Cinzel amber underlined text link

## 7. Auth Page

- [ ] 7.1 Remove both `UCard` wrappers from `auth.vue`
- [ ] 7.2 Add IM Fell English wordmark title (placeholder: "Grimoire") and Cinzel subtitle above the form
- [ ] 7.3 Replace `UFormField` labels with Cinzel uppercase tracking-widest text
- [ ] 7.4 Style the submit `UButton` with `bg-grimoire-accent text-grimoire-bg` classes
- [ ] 7.5 Collapse login and register into a single form column with a Cinzel toggle link between them

## 8. Setup Wizard

- [ ] 8.1 Remove all `UCard` wrappers from `setup.vue` step sections
- [ ] 8.2 Replace the numbered circle progress indicator with Cinzel text labels; current step amber-underlined, past faded, future near-invisible
- [ ] 8.3 Rename step headings to narrative equivalents (Name your hero, Choose your lineage, Choose your calling, Your gifts and shortcomings, The shape of your story, Three tales await, Forge the world)
- [ ] 8.4 Apply borderless logbook treatment to the character name input (same as play input)
- [ ] 8.5 Restyle race/class/tone/death-mode selection cards: `bg-grimoire-surface border border-grimoire-accent-dim/20 rounded-sm`; selected: `border-grimoire-accent bg-grimoire-accent/8`; card name in IM Fell English, traits in Cinzel
- [ ] 8.6 Apply PERMADEATH danger treatment: selected state `bg-red-950/30 border-red-800/50`, hover `border-red-900/50`
- [ ] 8.7 Ability score chips: `bg-grimoire-surface border border-grimoire-accent-dim/30 font-mono`; used = `opacity-40 line-through`; assignment buttons `w-12 h-12 rounded-sm`; ability labels in Cinzel
- [ ] 8.8 Rewrite concept cards: Roman numeral (I/II/III) in Cinzel amber-dim; premise in IM Fell English `text-[1.125rem]`; conflict with Cinzel label; antagonist hint italic below hairline
- [ ] 8.9 Replace world-gen bullet list with IM Fell English prose paragraphs
- [ ] 8.10 Replace world-gen submit button with Cinzel `"Forge the world"`; replace loading state with breathing amber dot + `"The world takes shape..."` (hide the button entirely while submitting)
- [ ] 8.11 Replace "Campaign is ready!" state: remove green icon and `UButton`; render IM Fell English `"The world is ready."` heading and Cinzel `"Begin your story →"` text link
- [ ] 8.12 Replace back navigation `UButton ghost` with Cinzel `← Back` text link

## 9. Character Sheet

- [ ] 9.1 Replace `UCard` section containers in `character.vue` with plain divs using `border-b border-grimoire-accent-dim/20` section separators
- [ ] 9.2 Render character name in IM Fell English `text-4xl text-grimoire-text`
- [ ] 9.3 Render race/class/level line in Cinzel `text-sm tracking-wider uppercase text-grimoire-muted`
- [ ] 9.4 Replace section headings with Cinzel `text-xs tracking-[0.4em] uppercase text-grimoire-muted` + hairline separator
- [ ] 9.5 Render HP, AC, and core stat numbers in `font-mono text-2xl text-grimoire-accent` with Cinzel labels
- [ ] 9.6 Update navigation links to Cinzel uppercase tracking-widest; active link in amber
- [ ] 9.7 Replace loading spinner with breathing amber dot + `"Reading the chronicle..."` in IM Fell English italic

## 10. Quest Log

- [ ] 10.1 Replace `UCard bg-gray-900 border-gray-700` quest cards with `bg-grimoire-surface border border-grimoire-accent-dim/20 rounded-sm`
- [ ] 10.2 Render quest title in IM Fell English `text-base text-grimoire-text`
- [ ] 10.3 Render quest description in IM Fell English `text-sm leading-relaxed text-grimoire-text/80`
- [ ] 10.4 Replace `UBadge` active badge with Cinzel `text-xs tracking-widest uppercase text-grimoire-accent border border-grimoire-accent-dim/50 px-2 py-0.5 rounded-sm`
- [ ] 10.5 Style completed quests with `opacity-60` and title `line-through`
- [ ] 10.6 Replace objective `UCheckbox` with `✦` (completed, amber) and `◦` (pending, muted) text markers
- [ ] 10.7 Replace empty-state dashed border box with IM Fell English italic `text-grimoire-muted` prose (e.g. "No quests yet. The road ahead is unwritten.")
- [ ] 10.8 Replace loading spinner with breathing amber dot + `"Consulting the scroll..."` in IM Fell English italic
- [ ] 10.9 Update navigation links to Cinzel uppercase; active link in amber

## 11. Verification

- [ ] 11.1 Run `yarn workspace web typecheck` — zero type errors
- [ ] 11.2 Start dev server and verify play page loads with grimoire background, book header, prose transcript, and no sidebar
- [ ] 11.3 Verify transcript renders DM narrative with amber gutter border and drop cap on first event
- [ ] 11.4 Verify player input annotation shows character name in Cinzel, not "You:"
- [ ] 11.5 Verify ornamental divider appears between exchanges but not at session start
- [ ] 11.6 Verify suggested actions render as inline italic fragments with `·` separators, not chips
- [ ] 11.7 Verify input textarea is borderless at rest; amber left border appears on focus
- [ ] 11.8 Verify combat panel shows danger tint, amber active-turn highlight, and page floor transitions on combat start
- [ ] 11.9 Verify campaign end screen fades in, shows character name and floating epitaph, no skull icon
- [ ] 11.10 Verify auth page has no UCard, shows wordmark, and submit button is amber
- [ ] 11.11 Verify setup wizard concept cards show Roman numerals and prose content, not "Concept 1/2/3"
- [ ] 11.12 Verify PERMADEATH card uses red selected state
- [ ] 11.13 Verify world generation loading state shows breathing dot and hides the button
- [ ] 11.14 Run `yarn workspace web test` — all existing tests pass
