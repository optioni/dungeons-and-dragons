## 1. Bootstrap Logging

- [x] 1.1 Replace ad hoc stdout startup output in `apps/api/src/main.ts` with NestJS `Logger` calls that log effective port, GraphQL endpoint path, CORS origin, and environment name
- [x] 1.2 Add error-level bootstrap failure logging in `main.ts` before process exit

## 2. Session Input Logging

- [x] 2.1 Add `log`-level entry in `SessionResolver.sendPlayerInput` that logs session ID, campaign ID, and that the async DM turn has been scheduled (no player text)
- [x] 2.2 Add `error`-level logging in `SessionResolver.sendPlayerInput` for validation or authorization failures (session ID and failure reason only)

## 3. DM Turn Orchestration Logging

- [x] 3.1 Add turn-start `log` in `DmOrchestrator` with session ID and scene type
- [x] 3.2 Add context-load summary `log` in `DmOrchestrator` after context assembly (memory count, diary entry count — no content)
- [x] 3.3 Add Anthropic stream-start `log` in `DmOrchestrator` with model config key
- [x] 3.4 Add stop-reason and tool-use iteration count `log` in `DmOrchestrator` after Anthropic stream completes
- [x] 3.5 Add per-tool-dispatch `log` in `DmOrchestrator` with tool name and success/structured-error flag (no payloads)
- [x] 3.6 Add turn-completion `log` in `DmOrchestrator` with session ID and duration in ms
- [x] 3.7 Add turn-failure `error` log in `DmOrchestrator` with session ID and error class (no narrative or prompt content)

## 4. Stream Publisher Lifecycle Logging

- [x] 4.1 Add `log` in `StreamPublisher` on client subscribe with session ID and new subscriber count
- [x] 4.2 Add `log` in `StreamPublisher` on client unsubscribe/disconnect with session ID and remaining subscriber count
- [x] 4.3 Add `warn` in `StreamPublisher` when a chunk is published with zero active subscribers (session ID)
- [x] 4.4 Add `log` in `StreamPublisher` on stream completion with session ID and subscriber count at time of completion

## 5. World Tick Lifecycle Logging

- [x] 5.1 Add `log` in `WorldTickWorker` on job receipt with job ID and campaign ID
- [x] 5.2 Add `log` in `WorldTickWorker` on successful lock acquisition with campaign ID
- [x] 5.3 Add `warn` in `WorldTickWorker` when the Redis lock is already held (lock skip) with campaign ID
- [x] 5.4 Add `error` in `WorldTickWorker` on campaign lookup failure with job ID and campaign ID
- [x] 5.5 Add `log` in `WorldTickWorker` after campaign lookup with due NPC count and conversation pair count
- [x] 5.6 Add `log` in `WorldTickWorker` at each pipeline phase transition (NPC agenda processing start/end, diary writing start/end)
- [x] 5.7 Add `log` in `WorldTickWorker` for outcome counts (successes, skips, failures) after NPC processing
- [x] 5.8 Add `log`/`error` in `WorldTickWorker` for diary write success or failure
- [x] 5.9 Add `log` in `WorldTickWorker` on job completion with total duration in ms

## 6. External Anthropic Call Logging

- [x] 6.1 Add outbound `log` and result `log`/`error` in `DmOrchestrator` for the primary Anthropic stream call (provider, model config key, duration, success/failure class)
- [x] 6.2 Add outbound and result logging in `InnerMonologueService` for Anthropic calls (provider, model config key, duration, success/failure class — no prompt/response text)
- [x] 6.3 Add outbound and result logging in `WorldTickWorker` for each per-NPC Anthropic call (provider, model config key, duration, success/failure class)

## 7. Embedding Call Logging

- [x] 7.1 Add outbound and result logging in `EmbeddingService` for Voyage AI calls (provider, input count, duration, success/failure class — no input text or vectors)

## 8. Tests

- [x] 8.1 Update `DmOrchestrator` unit tests to mock `Logger` and assert that turn-start, tool-dispatch, and turn-failure logs fire with correct metadata
- [x] 8.2 Update `WorldTickWorker` unit tests to assert lock-skip warn, phase-transition logs, and failure error logs
- [x] 8.3 Update `StreamPublisher` unit tests to assert subscribe, unsubscribe, and zero-subscriber warn logs
- [x] 8.4 Update `EmbeddingService` unit tests to assert outbound and failure logs (provider, input count, duration)
- [x] 8.5 Run `cd apps/api && yarn typecheck` and fix any type errors introduced

## 9. Verification

- [x] 9.1 Start the API locally and confirm startup logs include port, GraphQL endpoint, CORS origin, and environment
- [x] 9.2 Trigger a DM turn and confirm orchestration lifecycle logs appear in order with correct metadata
- [x] 9.3 Confirm no player text, narrative text, or credentials appear in any log line

