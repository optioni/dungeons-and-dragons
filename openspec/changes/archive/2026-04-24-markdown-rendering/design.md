## Context

The play transcript in `apps/web/pages/campaign/[id]/play.vue` renders `GameEvent` records via `TranscriptView.vue`. DM narrative events (`DM_NARRATIVE`) contain Claude's markdown output — bold, italic, headings, horizontal rules, and lists — displayed as raw text. This change adds client-side markdown rendering scoped to completed `DM_NARRATIVE` events only.

No API, schema, or database changes are required. The full impact is confined to `apps/web`.

## Goals / Non-Goals

**Goals:**
- Parse and render markdown for completed `DM_NARRATIVE` events using `marked`
- Apply `@tailwindcss/typography` prose styling in a dark-theme variant matching the `gray-950` background
- Keep in-progress streaming text as plain text — render markdown only after streaming completes
- Sanitise parsed HTML with `DOMPurify` before injecting via `v-html`
- Leave `PLAYER_INPUT` and `INNER_VOICE` events as-is (plain text / plain italic)

**Non-Goals:**
- Server-side markdown rendering — client-only
- Markdown support for non-narrative event types
- Real-time markdown parsing during streaming (orphaned syntax mid-stream is unacceptable)
- Custom markdown extensions or D&D-specific syntax

## Decisions

### 1. Use `marked` for parsing

`marked` is a well-maintained, lightweight CommonMark parser with no runtime dependencies. The alternative is `markdown-it`, which is more extensible but heavier. Since the only requirement is standard prose markdown (no plugins, no custom syntax), `marked` is the right fit. `remark`/`rehype` would add significant bundle size for no benefit here.

### 2. Parse only after streaming completes

Claude streams tokens one at a time. Parsing incrementally would produce orphaned `*` and `#` characters visible to the player while the DM is still writing. The event model already has a clean boundary: streaming events accumulate into a `DM_NARRATIVE` record once complete. The component renders plain text (using `whitespace-pre-wrap`) while `isStreaming` is true, then switches to `v-html` with parsed output once the event is finalised. No buffering logic needed — the condition is a field on the event.

### 3. Sanitise with `DOMPurify`

`marked` produces HTML from trusted-ish input (Claude output via the API), but the source is ultimately AI-generated text, not a hardcoded string. `DOMPurify` is the standard browser-side sanitiser and adds negligible overhead. It strips `<script>`, event attributes, and dangerous URLs before injection. The alternative — relying on marked's own `sanitize` option — was deprecated and removed in v4; DOMPurify is now the recommended path.

### 4. Dark prose variant via Tailwind Typography

`@tailwindcss/typography` provides the `prose` utility class. The default prose styles assume a light background. Rather than overriding individual element colours inline, a custom `prose-invert`-based variant will be configured in `tailwind.config.ts` to match the app's `gray-950` surface. Headings, body text, bold, italic, lists, blockquotes, and `<hr>` will be tuned to the dark palette. This keeps all typography rules in one config location rather than scattered across component styles.

### 5. Scoped to `TranscriptView` — no shared component

Markdown rendering is specific to `DM_NARRATIVE` events in the transcript. Extracting a generic `MarkdownBlock` component would be premature — there is no other use case. The parsing and sanitisation logic lives in a composable (`useMarkdown`) so it is testable in isolation, but the component boundary stays at `TranscriptView`.

## Risks / Trade-offs

- **`v-html` XSS surface** → Mitigated by DOMPurify before every inject. Claude output is not direct user input, but defence-in-depth applies.
- **`marked` output includes block-level elements** inside transcript list items → Acceptable; prose container handles block layout correctly. No `<p>` wrapping issues expected for normal DM narrative.
- **Tailwind Typography dark customisation is verbose** → One-time config cost; no ongoing maintenance burden once the palette is locked in.
- **Bundle size increase** (`marked` ~40 kB min, `DOMPurify` ~25 kB min, `@tailwindcss/typography` CSS) → Acceptable for a web app in active development with no current bundle budget constraints.

## Open Questions

- Does the existing `TranscriptView` receive a streaming-state flag per event, or must it derive `isStreaming` from the subscription state? Needs confirmation before the spec is written.
