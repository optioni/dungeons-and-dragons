## 1. Database Migration

- [ ] 1.1 Create a MikroORM migration adding `travel_encounter_enabled boolean NOT NULL DEFAULT true` to the `campaign` table
- [ ] 1.2 Add `travelEncounterEnabled: boolean = true` property to the `Campaign` entity (`apps/api/src/campaign/entities/campaign.entity.ts`)

## 2. Encounter Roll Service

- [ ] 2.1 Write a failing test in `travel.service.spec.ts` for `travelTo` returning `encounter: null` when the roll is below 15
- [ ] 2.2 Write a failing test for `travelTo` triggering an encounter when the d20 + danger modifier ≥ 15
- [ ] 2.3 Write a failing test for `travelTo` skipping the encounter roll when `Campaign.travelEncounterEnabled` is `false`
- [ ] 2.4 Add a `dangerModifier(state: LocationState): number` helper in `TravelService` mapping `SAFE=0`, `TENSE=2`, `THREATENED=4`, `HOSTILE=6`, `RUINED=3`
- [ ] 2.5 Inject `RollService` into `TravelService` and add the post-move encounter roll call in `travelTo`
- [ ] 2.6 Update `TravelResult.data` type to include `encounter: EncounterResult | null`

## 3. Monster Draw Query

- [ ] 3.1 Write a failing test for a `drawEncounterMonsters` method that returns 1–3 `SrdMonster` entries within the CR bracket for a given character level
- [ ] 3.2 Write a failing test for `drawEncounterMonsters` returning an empty array when no monsters exist in the bracket
- [ ] 3.3 Add `drawEncounterMonsters(characterLevel: number): Promise<SrdMonster[]>` to `TravelService`, injecting a raw `EntityManager` query using `ORDER BY RANDOM() LIMIT` with CR bracket `[floor(level/2)-1, floor(level/2)+1]` clamped to [0, 30]
- [ ] 3.4 Fetch `Character.level` from the active `Campaign.characterId` in `travelTo` before calling `drawEncounterMonsters`

## 4. Temporary NPC Materialisation and Combat Start

- [ ] 4.1 Write a failing test for `travelTo` constructing temporary `Npc` entities (not persisted) from drawn `SrdMonster` entries with correct `hp`, `maxHp`, and `name`
- [ ] 4.2 Write a failing test for `travelTo` calling `CombatService.startCombat` with the player character and temporary NPCs when encounter triggers
- [ ] 4.3 Inject `CombatService` into `TravelService`
- [ ] 4.4 In `travelTo`, after a successful draw, use `em.create(Npc, { ... })` (no `em.persist`) for each monster and call `combat.startCombat(sessionId, participants)` directly
- [ ] 4.5 Verify `CombatService.startCombat` resolves NPC stats from the in-memory entity object rather than a DB lookup (adjust the combatant-init path if it currently calls `em.findOne` for NPC by id)
- [ ] 4.6 Include a generated `encounter.description` string in the `travelTo` result (e.g. "A goblin ambushes you on the road")

## 5. update_campaign_settings Tool

- [ ] 5.1 Write a failing test in `game-engine-tool-registrar.spec.ts` for `update_campaign_settings` setting `travelEncounterEnabled: false` on the campaign
- [ ] 5.2 Write a failing test for `update_campaign_settings` with an empty payload leaving campaign fields unchanged
- [ ] 5.3 Add `updateCampaignSettings(campaignId: number, settings: { travelEncounterEnabled?: boolean }): Promise<...>` method to `CampaignService` (or `TravelService` if simpler)
- [ ] 5.4 Register the `update_campaign_settings` tool in `GameEngineToolRegistrarService` wired to the new method
- [ ] 5.5 Add the new tool handler to `GameEngineModule` providers/imports if a new service was introduced

## 6. Integration and Cleanup

- [ ] 6.1 Run `yarn test` in `apps/api` and confirm all new and existing tests pass
- [ ] 6.2 Run `yarn mikro-orm migration:up` to verify the migration applies cleanly
- [ ] 6.3 Confirm `travel.service.ts` has no `any` types and passes TypeScript strict checks
