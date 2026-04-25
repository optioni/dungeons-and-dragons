## 1. Install Dependencies

- [x] 1.1 Add `marked` and `dompurify` to `apps/web/package.json` and install
- [x] 1.2 Add `@types/dompurify` as a dev dependency in `apps/web/package.json`
- [x] 1.3 Add `@tailwindcss/typography` to `apps/web/package.json` and install

## 2. Configure Tailwind Typography

- [x] 2.1 Add `@plugin "@tailwindcss/typography"` to `apps/web/assets/css/main.css`
- [x] 2.2 Add a dark prose theme override in `apps/web/assets/css/main.css` — customise `--tw-prose-*` CSS variables for headings, body, bold, links, `<hr>`, and blockquotes to match the `gray-950` surface

## 3. Create useMarkdown Composable

- [x] 3.1 Create `apps/web/composables/useMarkdown.ts` that exports a `parseMarkdown(text: string): string` function
- [x] 3.2 In `parseMarkdown`, call `marked.parse()` to produce HTML, then pass the result through `DOMPurify.sanitize()` before returning
- [x] 3.3 Configure `marked` with `{ async: false }` so `parse()` returns a string synchronously
- [x] 3.4 Write a Vitest unit test at `apps/web/tests/composables/useMarkdown.test.ts` covering: bold/italic rendering, heading rendering, `---` to `<hr>`, script tag stripped, event handler attribute stripped

## 4. Update TranscriptView

- [x] 4.1 Import `parseMarkdown` from the `useMarkdown` composable in `TranscriptView.vue`
- [x] 4.2 Replace the `{{ narrative }}` text interpolation for completed `DM_NARRATIVE` events with `v-html="parseMarkdown(narrative)"` inside a `prose prose-invert` container div
- [x] 4.3 Remove `whitespace-pre-wrap` from the completed `DM_NARRATIVE` bubble — prose handles layout
- [x] 4.4 Verify the in-progress streaming bubble (`props.inProgressText`) still renders as plain text with `whitespace-pre-wrap` and is NOT passed through `parseMarkdown`
- [x] 4.5 Verify `PLAYER_INPUT` events are unchanged (plain text, no `v-html`)
- [x] 4.6 Verify `innerVoiceText` remains plain italic text with no markdown parsing

## 5. Visual Verification

- [x] 5.1 Run the dev server (`cd apps/web && yarn dev`) and open a campaign play session
- [x] 5.2 Confirm DM narrative with `**bold**`, `*italic*`, `##` headings, `---`, and bullet lists renders correctly
- [x] 5.3 Confirm no visual regression on player input bubbles, inner voice text, or the streaming cursor animation
- [x] 5.4 Confirm `prose` dark theme colours are legible against the `gray-800` bubble background
