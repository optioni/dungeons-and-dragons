# API Observability & Logging

## Purpose

Defines structured observability logging for the NestJS API using the built-in `Logger`. Covers startup milestones, DM turn lifecycle, SSE stream events, world tick pipeline, external LLM and embedding calls, redaction policy, and log level conventions. All logs are metadata-only — no player input, narrative text, prompt content, or credentials are ever written to logs.

## Requirements

### Requirement: API bootstrap logging
The system SHALL log startup and configuration milestones using NestJS `Logger` from `main.ts`, including effective port, GraphQL endpoint URL, CORS origin, and environment name. These logs SHALL appear before the application begins accepting requests.

#### Scenario: Successful bootstrap
- **WHEN** the NestJS application boots successfully
- **THEN** the log output SHALL include the effective port, the GraphQL endpoint path, the CORS origin, and the environment (e.g., development/production)

#### Scenario: Bootstrap failure
- **WHEN** the application fails to start (e.g., database connection error, port in use)
- **THEN** the system SHALL log the failure with error class and a human-readable message before the process exits

---

### Requirement: Session input acceptance logging
The system SHALL log when a player input is received and the async DM turn is scheduled, using `SessionResolver` as the logging boundary.

#### Scenario: Input accepted
- **WHEN** `SessionResolver.sendPlayerInput` is called with a valid session
- **THEN** the system SHALL log the session ID, campaign ID, and that the turn has been scheduled asynchronously

#### Scenario: Input rejected
- **WHEN** `SessionResolver.sendPlayerInput` fails validation or authorization
- **THEN** the system SHALL log the session ID and failure reason without logging the raw player input text

---

### Requirement: DM turn orchestration lifecycle logging
The system SHALL log DM turn lifecycle milestones inside `DmOrchestrator`, covering turn start, context load summary, Anthropic stream start, stream completion, stop reason, tool-use loop iterations, tool dispatch results, turn completion, and turn failure.

#### Scenario: Successful DM turn
- **WHEN** a DM turn completes without error
- **THEN** the system SHALL log: turn start (with session ID, scene type), context load summary (e.g., memory count, diary entry count), Anthropic stream start (model config name), stop reason, number of tool-use loop iterations, names of tools dispatched, and turn completion with duration

#### Scenario: Failed DM turn
- **WHEN** a DM turn encounters an unrecoverable error
- **THEN** the system SHALL log the failure with error class and session ID, without logging raw player text, prompt blocks, or full narrative content

#### Scenario: Tool dispatch logging
- **WHEN** the DM turn dispatches a tool call
- **THEN** the system SHALL log the tool name and whether the result was a success or structured error, without logging full tool input or output payloads

---

### Requirement: Stream subscriber lifecycle logging
The system SHALL log SSE stream subscriber lifecycle events in `StreamPublisher`, including subscribe, unsubscribe, stream completion, and publish-to-zero-subscribers conditions.

#### Scenario: Client subscribes to stream
- **WHEN** a client subscribes to the SSE stream for a session
- **THEN** the system SHALL log the session ID and subscriber count after the new subscription

#### Scenario: Client unsubscribes from stream
- **WHEN** a client unsubscribes or the connection drops
- **THEN** the system SHALL log the session ID and remaining subscriber count

#### Scenario: Publish with no subscribers
- **WHEN** the publisher attempts to emit a chunk but there are zero active subscribers
- **THEN** the system SHALL log a warning with the session ID indicating the chunk was dropped

#### Scenario: Stream completion
- **WHEN** the stream for a session is marked complete
- **THEN** the system SHALL log the session ID and total subscriber count at completion time

---

### Requirement: World tick lifecycle logging
The system SHALL log world tick job lifecycle inside `WorldTickWorker`, including job receipt, lock acquisition or skip, campaign lookup, NPC and conversation counts, pipeline phase transitions, outcomes, diary write status, and job duration.

#### Scenario: Lock acquired and tick runs
- **WHEN** the world tick job acquires the Redis lock and begins processing
- **THEN** the system SHALL log: job ID, campaign ID, lock acquired, due NPC count, conversation pair count, each pipeline phase start (e.g., NPC agenda processing, diary writing), outcome counts (successes, skips, failures), diary write success or failure, and total duration

#### Scenario: Lock already held — tick skipped
- **WHEN** the world tick job cannot acquire the Redis lock
- **THEN** the system SHALL log the campaign ID and that the tick was skipped due to an active lock

#### Scenario: Campaign lookup failure
- **WHEN** the world tick job cannot find the campaign for the given job data
- **THEN** the system SHALL log the job ID, campaign ID (if available), and the failure class

---

### Requirement: External LLM call logging
The system SHALL log outbound Anthropic API calls at the service boundary in `DmOrchestrator`, `WorldTickWorker`, `InnerMonologueService`, and any other service that calls the Anthropic SDK directly. Logs SHALL include provider name, model config key, duration, and success or failure class. Logs SHALL NOT include prompt text, request bodies, response text, or API keys.

#### Scenario: Successful Anthropic call
- **WHEN** an Anthropic API call completes successfully
- **THEN** the system SHALL log provider name, model config key (not raw model ID if it can be avoided), duration in milliseconds, and success status

#### Scenario: Failed Anthropic call
- **WHEN** an Anthropic API call fails (network error, rate limit, API error)
- **THEN** the system SHALL log provider name, model config key, error class (e.g., rate_limit, network_error, api_error), and duration without logging request or response content

---

### Requirement: Embedding call logging
The system SHALL log outbound Voyage AI embedding calls at the service boundary in `EmbeddingService`. Logs SHALL include provider name, input count, duration, and success or failure class. Logs SHALL NOT include input text or embedding vectors.

#### Scenario: Successful embedding call
- **WHEN** a Voyage AI embedding call completes successfully
- **THEN** the system SHALL log provider name, input count, duration in milliseconds, and success status

#### Scenario: Failed embedding call
- **WHEN** a Voyage AI embedding call fails
- **THEN** the system SHALL log provider name, input count, error class, and duration without logging input text or vectors

---

### Requirement: Log redaction policy
All logs in the API SHALL exclude: raw player input text, generated narrative text, prompt blocks (system, user, assistant), full tool input or output payloads, API keys, JWT tokens, authorization headers, cookies, session tokens, full diary entry content, full memory content, and unbounded JSON objects.

#### Scenario: Sensitive field not logged
- **WHEN** any logging call in the system is made
- **THEN** the log output SHALL NOT contain player input text, narrative text, prompt text, API credentials, or auth tokens

#### Scenario: Safe metadata logged
- **WHEN** any logging call in the system is made
- **THEN** the log output SHALL contain only metadata fields: IDs, counts, durations, model config keys, stop reasons, tool names, phase names, success flags, and error classes

---

### Requirement: Log level conventions
The system SHALL use NestJS `Logger` log levels consistently: `log` for normal lifecycle events, `warn` for recoverable anomalies (e.g., zero subscribers, lock skip), and `error` for failures that affect gameplay or external call outcomes. `debug` MAY be used for high-frequency or verbose details gated behind a debug build.

#### Scenario: Normal lifecycle event
- **WHEN** a normal lifecycle milestone occurs (startup, turn start, tick complete)
- **THEN** the system SHALL use the `log` level

#### Scenario: Recoverable anomaly
- **WHEN** a recoverable anomaly occurs (publish with zero subscribers, lock held by another job)
- **THEN** the system SHALL use the `warn` level

#### Scenario: Error condition
- **WHEN** a failure impacts gameplay or an external call fails
- **THEN** the system SHALL use the `error` level
