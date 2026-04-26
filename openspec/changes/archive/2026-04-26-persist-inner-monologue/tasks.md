## 1. Database

- [x] 1.1 Add `lastInnerVoice` nullable text property to `GameSession` entity with `@Field(() => String, { nullable: true })` and `@Property({ type: 'text', nullable: true })`
- [x] 1.2 Generate MikroORM migration for the new column (`yarn mikro-orm migration:create`)
- [x] 1.3 Run migration to apply the column (`yarn mikro-orm migration:up`)

## 2. API — Persist after generation

- [x] 2.1 In `InnerMonologueService.runIfApplicable`, after publishing `INNER_VOICE` chunks, set `session.lastInnerVoice = text` and flush via the entity manager
- [x] 2.2 Wrap the flush in a try/catch that logs and swallows errors without re-throwing
- [x] 2.3 Update `InnerMonologueService` unit tests to assert `lastInnerVoice` is written on success and that a flush error does not propagate

## 3. API — Clear on player input

- [x] 3.1 In `SessionResolver.sendPlayerInput`, set `session.lastInnerVoice = null` and flush before calling `dmOrchestrator.runTurn`
- [x] 3.2 Add unit test asserting `lastInnerVoice` is null after `sendPlayerInput` is called

## 4. API — GraphQL exposure

- [x] 4.1 Confirm `lastInnerVoice` is included in the `activeSession` resolver response (field should be auto-exposed via entity decoration — verify in schema)

## 5. Frontend

- [x] 5.1 Add `lastInnerVoice` to the `ACTIVE_SESSION_QUERY` GraphQL fragment in `apps/web/graphql/session.ts`
- [x] 5.2 In `play.vue`, after `applySessionData` populates session state on mount, seed `innerVoiceText` from `activeSession.lastInnerVoice` if non-null
- [x] 5.3 Update `play.spec.ts` to cover the restore-on-load path (session with `lastInnerVoice` set → `innerVoiceText` initialised)
