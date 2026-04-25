## Why

The API currently exposes too little runtime visibility for the parts that matter most during local play: startup, GraphQL operations, DM turns, tool calls, streaming, world ticks, and external LLM or embedding calls. Adding intentional API-side logging now will make it easier to understand what the system is doing, diagnose stuck turns, and distinguish infrastructure failures from gameplay or orchestration bugs.

## What Changes

- Add a structured API observability baseline for high-value runtime events without logging secrets, full prompts, raw player input, or generated narrative.
- Log API bootstrap and configuration milestones, including effective port, GraphQL endpoint, and CORS origin.
- Log gameplay orchestration milestones around session input, DM turn start and completion, prompt context assembly, Anthropic stop reasons, tool dispatches, stream subscriber lifecycle, and turn failures.
- Log background world-tick lifecycle events, including job receipt, lock acquisition or skip, due NPC counts, conversation counts, pipeline phases, outcomes, diary write status, and duration.
- Log outbound external-service calls at the operational level, including provider/model, duration, success, and failure class for Anthropic and Voyage AI interactions.
- Keep the first implementation on NestJS `Logger` unless design work identifies a clear need for an additional structured logging dependency.
- No breaking API, schema, or database changes are intended.

## Capabilities

### New Capabilities

- `api-observability-logging`: Defines the required API logging coverage, redaction rules, event metadata, and verification expectations for local and future operational debugging.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/api/src/main.ts`, session and LLM orchestration services, stream publisher, world tick worker, memory and embedding services, and selected resolver/service entry points where operational lifecycle logs are useful.
- Affected systems: local API development, GraphQL request handling, SSE stream debugging, BullMQ world-tick processing, Anthropic calls, and Voyage embedding calls.
- Dependencies: no new dependency is expected for the initial pass; design may revisit this if JSON log formatting or request correlation requires a dedicated logger.
- Security and privacy: logs must avoid secrets, authorization tokens, full prompts, raw player text, full generated narrative, and large tool payloads.
