## 1. Play Route Stream And Shell State

- [ ] 1.1 Update `apps/web/pages/campaign/[id]/play.vue` stream handling so `INNER_VOICE` is rendered separately from DM narrative and duplicate terminal `DONE` chunks are treated as idempotent
- [ ] 1.2 Refine play-route reconciliation so transcript-only chunks do not retrigger combat layout changes or blocking overlay state transitions
- [ ] 1.3 Keep the main player input disabled whenever streaming or a blocking overlay is active, while preserving suggested-action and quick-action prefills without auto-submit

## 2. Combat And Sidebar UX

- [ ] 2.1 Align combat panel mounting in `apps/web/pages/campaign/[id]/play.vue` with durable `sceneType` plus non-null `combatSession`
- [ ] 2.2 Update `apps/web/components/session/CombatPanel.vue` quick actions so they prefill the play input without submitting and stay disabled during active DM streaming
- [ ] 2.3 Refresh `apps/web/components/session/CharacterSidebar.vue` and related play-route data flow so HP, AC, conditions, and spell slots reconcile from durable server state after completed turns

## 3. Blocking Overlays

- [ ] 3.1 Finalize the level-up overlay in `apps/web/pages/campaign/[id]/play.vue` so it opens from stream or queried pending state, validates hit-point gain, and supports ASI-versus-feat selection when applicable
- [ ] 3.2 Ensure successful `apply_level_up` closes the overlay and failed submissions keep it open with inline error feedback
- [ ] 3.3 Add the death-save UI to the play shell so it appears from durable dying-state data, shows success/failure progress, and remains compatible with both narrative and combat layouts

## 4. Verification

- [ ] 4.1 Extend `apps/web/tests/play.spec.ts` to cover idempotent second `DONE`, separate `INNER_VOICE` rendering behavior, blocking input states, level-up overlay entry paths, and death-save visibility
- [ ] 4.2 Extend `apps/web/tests/CombatPanel.spec.ts` to cover the updated quick-action prefill behavior and combat-panel visibility rules tied to durable session state
- [ ] 4.3 Run targeted web verification for the touched UI surface and update any failing expectations
