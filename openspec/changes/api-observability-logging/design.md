## Context

The API already uses NestJS `Logger` in a few services, mostly for failure paths in DM orchestration, memory generation, embeddings, and world ticks. Normal lifecycle visibility is sparse: startup writes directly to stdout, DM turns do not expose step timing or tool-loop progress, stream subscriber lifecycle is silent, and world ticks only log selected errors or lock skips.

The main stakeholder is a local developer running the game and trying to understand whether the API is booting, receiving GraphQL operations, streaming a turn, waiting on Anthropic or Voyage AI, dispatching tools, or processing background world state. Logs must be useful during local development without exposing secrets, raw prompts, raw player input, generated narrative, auth tokens, or large tool payloads.

## Goals / Non-Goals

**Goals:**

- Provide enough API-side logs to follow the lifecycle of startup, session input, DM turn orchestration, stream delivery, world ticks, and external LLM or embedding calls.
- Keep log metadata compact, safe, and stable: IDs, counts, phases, models, durations, stop reasons, subscriber counts, status values, and failure classes.
- Use existing NestJS logging conventions so the first pass has no dependency churn and minimal architecture risk.
- Make logs useful in both successful and failed flows, especially around async work where the GraphQL mutation returns before the DM turn finishes.
- Leave room for future correlation IDs or JSON logging without requiring them now.

**Non-Goals:**

- No new GraphQL schema, database model, migration, or web UI is required.
- No centralized log aggregation, tracing backend, OpenTelemetry integration, or metrics dashboard is included.
- No full request or prompt logging. Player text, generated narrative, prompt blocks, API keys, cookies, authorization headers, and full tool payloads remain out of logs.
- No attempt to make all application services equally verbose. The initial pass focuses on operationally important paths.

## Decisions

### Use NestJS `Logger` as the first implementation target

The implementation will replace ad hoc stdout startup output and expand existing `Logger` usage rather than adding pino, winston, OpenTelemetry, or another dependency.

Rationale: the app is still in active local development, Nest `Logger` is already present, and the immediate need is human-readable visibility. A dedicated structured logger would add configuration and migration work before there is evidence that local debugging needs it.

Alternative considered: introduce JSON structured logging immediately. This would be better for aggregation but premature for the current local-only workflow.

### Log lifecycle phases, not sensitive content

Logs will record phase-oriented metadata: operation names, session IDs, campaign IDs, user IDs where already available, scene type, counts, durations, model config names, stop reasons, tool names, result success flags, error codes, and subscriber counts.

Logs will not include raw player input, narrative text, prompt text, generated diary content, Anthropic request bodies, Voyage input text, auth headers, cookies, secrets, or unbounded JSON payloads.

Rationale: the goal is to know where the system is and what branch it took. Full content would create privacy risk and make logs harder to scan.

Alternative considered: log prompt and tool payload snippets behind a debug flag. This remains out of scope for this change because accidental sensitive logging would be easy and the current need can be met with metadata.

### Instrument the async turn path at its boundaries

`SessionResolver.sendPlayerInput` will log when input is accepted and the async DM turn is scheduled. `DmOrchestrator` will log turn start, context load summary, Anthropic stream start/completion, stop reason, tool-use loop iterations, tool dispatch summary, completion, and failure. The fire-and-forget call will keep catching failures inside the orchestrator so the resolver does not need to await it.

Rationale: this is where local debugging is currently hardest because the mutation can succeed while the actual turn continues in the background.

Alternative considered: await the DM turn inside the mutation to simplify error flow. That would change user-facing behavior and break the streaming design, so it is not appropriate.

### Instrument stream subscriber lifecycle without logging chunks

`StreamPublisher` will log subscribe, unsubscribe, complete, and publish-to-zero-subscriber conditions. It will not log every narrative chunk. For chunk publishing, only operational summaries such as chunk type and subscriber count should be considered, and noisy text chunk logs should be avoided.

Rationale: knowing whether the client is subscribed is useful when debugging missing UI updates. Logging every text chunk would flood output and expose generated narrative.

Alternative considered: log every chunk type. This may still be too noisy during normal narrative streaming, so the baseline should favor lifecycle events and exceptional publish conditions.

### Instrument world tick phases and external calls

`WorldTickWorker` will log job receipt, lock acquisition, lock skip, campaign lookup failures, start/end durations, due NPC count, conversation pair count, pipeline phase transitions, outcome counts, diary write success/failure, and per-call Anthropic failures. Existing error logs will be preserved and made more contextual where useful.

`MemoryService`, `InnerMonologueService`, and `EmbeddingService` will log outbound provider/model, duration, success, and failure class for Anthropic or Voyage calls, without logging prompt/input/output text.

Rationale: background processing and external services are the most likely places for slow or opaque behavior.

Alternative considered: centralize all provider calls behind one logging wrapper first. That may be useful later, but this pass should follow existing service boundaries and avoid a broad orchestration refactor.

### Keep verification focused on observable behavior

Unit tests should cover new logging behavior where it guards important policy, such as redaction boundaries, failure logs, and key lifecycle logs. Existing tests should be updated with logger mocks only where new logs interfere with assertions. Manual verification should include starting the API and exercising a representative DM turn or focused test path when external dependencies are not available.

Rationale: logs are behavior, but over-testing every log string makes the code brittle. Tests should validate coverage and safety where it matters.

Alternative considered: snapshot all logs in tests. This would create high maintenance cost for low confidence.

## Risks / Trade-offs

- Log noise makes local output harder to scan -> Use lifecycle summaries, counts, and durations; avoid per-token or per-narrative-chunk logs.
- Sensitive content leaks into logs -> Define explicit redaction rules in the spec and keep logs to metadata-only fields.
- Tests become brittle around exact messages -> Test policy and key lifecycle events, not every final sentence of every log line.
- Missing correlation across async operations -> Include stable IDs such as session ID, campaign ID, job ID, and tool-use ID where available; defer full request correlation until it is clearly needed.
- Provider call timing may be incomplete where calls are embedded deep in services -> Add timing at the service boundary first and avoid large refactors.

## Migration Plan

1. Add logging incrementally around startup, session resolver, stream publisher, DM orchestrator, world tick worker, memory generation, inner monologue, and embeddings.
2. Run focused API unit tests for touched services and update logger mocks where necessary.
3. Run API typecheck or the narrowest available verification command for the touched workspace.
4. If local infrastructure is available, start the API and verify startup logs and a representative gameplay flow. If not, document the environment blocker.

Rollback is straightforward: remove or reduce the added `Logger` calls. No schema, database, or API contract migration is expected.

## Open Questions

- Should log verbosity be controlled only by Nest's standard logger levels for now, or should this change introduce an API-specific environment flag for extra debug logs?
- Should future work add request or turn correlation IDs that flow through GraphQL, SSE, BullMQ jobs, and provider calls?
