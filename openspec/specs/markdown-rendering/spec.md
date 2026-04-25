# Markdown Rendering

## Purpose

Defines how DM narrative game events are rendered as parsed markdown HTML in the play transcript, while other event types remain as plain text. Covers markdown parsing, HTML sanitisation, and dark-theme prose styling.

## Requirements

### Requirement: DM narrative events render as parsed markdown
Completed `DM_NARRATIVE` game events SHALL be rendered as HTML parsed from their markdown content using the `marked` library. The parsed HTML SHALL be injected via `v-html` inside a `prose`-styled container.

#### Scenario: Bold and italic text renders correctly
- **WHEN** a completed `DM_NARRATIVE` event contains `**bold**` or `*italic*` markdown
- **THEN** the transcript SHALL display bold and italic formatted text, not raw asterisks

#### Scenario: Headings render as styled section headers
- **WHEN** a completed `DM_NARRATIVE` event contains `##` or `###` markdown headings
- **THEN** the transcript SHALL display visually distinct heading elements, not raw `#` characters

#### Scenario: Horizontal rules render as scene break dividers
- **WHEN** a completed `DM_NARRATIVE` event contains a `---` horizontal rule
- **THEN** the transcript SHALL display a styled `<hr>` divider element

#### Scenario: Bullet lists render as formatted lists
- **WHEN** a completed `DM_NARRATIVE` event contains a markdown bullet list
- **THEN** the transcript SHALL display a formatted `<ul>` list, not raw `- ` prefixed lines

### Requirement: Streaming DM narrative remains as plain text
While a `DM_NARRATIVE` event is in progress (streaming), the text SHALL be displayed as plain text without markdown parsing. Markdown parsing SHALL only occur after the event is marked as complete.

#### Scenario: In-progress streaming shows plain text
- **WHEN** a `DM_NARRATIVE` event is currently being streamed from the server
- **THEN** the transcript SHALL render the accumulated text as plain text with `whitespace-pre-wrap` styling

#### Scenario: Completed event switches to parsed markdown
- **WHEN** a streaming `DM_NARRATIVE` event transitions to complete
- **THEN** the transcript SHALL re-render the full event content as parsed markdown HTML

#### Scenario: No orphaned syntax during streaming
- **WHEN** Claude emits a partial markdown token mid-stream (e.g. a single `*` before the closing `*` arrives)
- **THEN** the transcript SHALL NOT display a flickering orphaned `*` character in parsed form

### Requirement: Parsed HTML is sanitised before injection
All HTML produced by `marked` SHALL be passed through `DOMPurify.sanitize()` before injection via `v-html`. The sanitised output SHALL strip `<script>` tags, inline event handlers, and dangerous URL schemes.

#### Scenario: Script tags are stripped
- **WHEN** the DM narrative content contains a `<script>` tag (e.g. injected via unexpected model output)
- **THEN** the sanitised HTML SHALL contain no `<script>` element

#### Scenario: Inline event handlers are stripped
- **WHEN** the parsed HTML contains an `onclick` or similar event attribute
- **THEN** the sanitised HTML SHALL not contain that attribute

#### Scenario: Safe HTML elements are preserved
- **WHEN** the DM narrative contains standard prose elements (`<p>`, `<strong>`, `<em>`, `<ul>`, `<li>`, `<h2>`, `<h3>`, `<hr>`, `<blockquote>`)
- **THEN** the sanitised HTML SHALL preserve those elements intact

### Requirement: Prose styling uses a dark-theme typography variant
The `prose` container wrapping DM narrative HTML SHALL use a custom dark-theme variant configured via `@tailwindcss/typography`. Text, headings, bold, italic, lists, blockquotes, and horizontal rules SHALL all be legible against the `gray-950` background.

#### Scenario: Body text is readable on dark background
- **WHEN** a `DM_NARRATIVE` event is rendered inside the prose container
- **THEN** paragraph text SHALL have sufficient contrast against the `gray-950` surface

#### Scenario: Headings are visually distinct from body text
- **WHEN** a `DM_NARRATIVE` event contains headings
- **THEN** headings SHALL be styled at a larger size or heavier weight than body text and SHALL be legible on the dark background

#### Scenario: Horizontal rules appear as subtle dividers
- **WHEN** a `DM_NARRATIVE` event contains `---`
- **THEN** the `<hr>` SHALL render as a low-contrast divider line, not invisible and not harsh white

### Requirement: Player input events remain unstyled plain text
`PLAYER_INPUT` game events SHALL NOT be processed through the markdown parser. They SHALL render as plain text.

#### Scenario: Player message with asterisks is not parsed
- **WHEN** a `PLAYER_INPUT` event contains `*text*`
- **THEN** the transcript SHALL display the literal `*text*` string, not italic formatted text

### Requirement: Inner voice events remain plain italic text
`INNER_VOICE` game events SHALL NOT be processed through the markdown parser. They SHALL render as plain italic text using existing styling.

#### Scenario: Inner voice is displayed as italic without markdown parsing
- **WHEN** an `INNER_VOICE` event is present in the transcript
- **THEN** the text SHALL be displayed in italic style without markdown processing applied
