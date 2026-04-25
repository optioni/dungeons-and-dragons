## Why

The DM narrative rendered in the play transcript is raw text. Claude's output routinely contains markdown — bold for emphasis, italics for speech or tone, headings for scene transitions, horizontal rules as scene breaks, and bullet lists for item descriptions or ability summaries. These render as literal `**`, `##`, and `---` characters, which breaks immersion and makes long narration harder to read. Fixing this is the minimum bar for the transcript to feel like a finished feature.

## What Changes

- Add `marked` for markdown-to-HTML parsing and `@tailwindcss/typography` for prose styling in `apps/web`.
- Render completed `DM_NARRATIVE` game events as parsed HTML via `v-html` inside a `prose` container.
- Keep in-progress streaming text as plain text until streaming completes, then re-render as markdown. This avoids orphaned asterisks flickering mid-stream.
- Configure a dark `prose` variant matching the existing `gray-950` background — headings, bold, italic, lists, blockquotes, and horizontal rules all styled for the dark theme.
- `PLAYER_INPUT` events remain plain text — no markdown needed for player messages.
- `INNER_VOICE` events remain plain italic text — intentionally unstyled.

## Capabilities

### New Capabilities

- `markdown-rendering`: Defines markdown rendering behaviour for the play transcript, streaming strategy, and prose styling rules for the dark theme.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/web/components/session/TranscriptView.vue`, `apps/web/tailwind.config.ts` (typography plugin), `apps/web/package.json`.
- Affected systems: play transcript only. No API, schema, or database changes.
- Dependencies: `marked` (markdown parser), `@tailwindcss/typography` (prose CSS).
- Security: `v-html` with user-controlled content requires sanitisation. DM narrative comes from Claude via the API — not directly from user input — but `marked` should be configured with a sanitiser or `DOMPurify` added as a precaution.
