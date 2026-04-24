import {
    describe, expect, it, vi,
} from 'vitest';

import { TravelService } from './travel.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Float: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Optional: () => () => {},
}));
vi.mock('@nestjs/event-emitter', () => ({
    EventEmitter2: class EventEmitter2 {
        emit() {}
    },
    InjectEventEmitter: () => () => {},
}));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeConnectionExecute(rows: unknown[] = []) {
    return vi.fn().mockResolvedValue(rows);
}

/* eslint-disable @typescript-eslint/naming-convention */
interface SrdMonsterRow { id: number; name: string; hit_points: number; challenge_rating: number }
/* eslint-enable @typescript-eslint/naming-convention */

function makeEm(entities: {
    discovery?: unknown
    campaign?: unknown
    location?: unknown
    character?: unknown
    mapLocations?: unknown[]
    monsters?: SrdMonsterRow[]
} = {}) {
    const connExecute = makeConnectionExecute(entities.monsters ?? []);
    return {
        findOne: vi.fn().mockImplementation((entity: unknown) => {
            const name = String(entity);
            if (name.includes('LocationDiscovery')) {
                return Promise.resolve(entities.discovery ?? null);
            }

            if (name.includes('Campaign')) {
                return Promise.resolve(entities.campaign ?? null);
            }

            if (name.includes('Character')) {
                return Promise.resolve(entities.character ?? null);
            }

            if (name.includes('Location')) {
                return Promise.resolve(entities.location ?? null);
            }

            return Promise.resolve(null);
        }),
        find: vi.fn().mockResolvedValue(entities.mapLocations ?? []),
        create: vi.fn().mockImplementation((_error: unknown, data: unknown) => ({ ...data as object, id: 99 })),
        persist: vi.fn(),
        flush: vi.fn(),
        getConnection: vi.fn().mockReturnValue({ execute: connExecute }),
        connExecuteRef: connExecute,
    };
}

describe('TravelService', () => {
    describe('travelTo', () => {
        it('updates currentLocationId when location is discovered', async () => {
            const campaign = { id: 10, currentLocationId: 1 };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const em = makeEm({ discovery, campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.travelTo(10, 2);
            expect(result.success).toBe(true);
            expect(campaign.currentLocationId).toBe(2);
        });

        it('returns UNDISCOVERED_LOCATION when no discovery exists', async () => {
            const campaign = { id: 10, currentLocationId: 1 };
            const em = makeEm({ discovery: null, campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.travelTo(10, 99);
            expect(result.success).toBe(false);
            expect((result as { errorCode: string }).errorCode).toBe('UNDISCOVERED_LOCATION');
        });

        it('returns encounter: null when roll is below 15', async () => {
            const campaign = { id: 10, currentLocationId: 1, travelEncounterEnabled: true };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const location = { id: 2, currentState: 'SAFE' };
            const character = { id: 5, level: 4, campaign: { id: 10 } };
            const dice = { d20: vi.fn().mockReturnValue(10) };
            const combat = { startCombat: vi.fn().mockResolvedValue({ success: true, data: {} }) };
            const em = makeEm({
                discovery, campaign, location, character, monsters: [],
            });
            const service = new TravelService(em as never, null as never, dice as never, combat as never);
            const result = await service.travelTo(10, 2, 1);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.encounter).toBeNull();
            }

            expect(combat.startCombat).not.toHaveBeenCalled();
        });

        it('triggers an encounter when d20 + danger modifier >= 15', async () => {
            const campaign = { id: 10, currentLocationId: 1, travelEncounterEnabled: true };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const location = { id: 2, currentState: 'SAFE' };
            const character = { id: 5, level: 4, campaign: { id: 10 } };
            /* eslint-disable @typescript-eslint/naming-convention */
            const monsters = [{ id: 1, name: 'Goblin', hit_points: 7, challenge_rating: 0.25 }];
            /* eslint-enable @typescript-eslint/naming-convention */
            const dice = { d20: vi.fn().mockReturnValue(15) };
            const combat = { startCombat: vi.fn().mockResolvedValue({ success: true, data: {} }) };
            const em = makeEm({
                discovery, campaign, location, character, monsters,
            });
            const service = new TravelService(em as never, null as never, dice as never, combat as never);
            const result = await service.travelTo(10, 2, 1);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.encounter).not.toBeNull();
                expect((result.data.encounter as { triggered: boolean }).triggered).toBe(true);
            }

            expect(combat.startCombat).toHaveBeenCalled();
        });

        it('skips encounter roll when travelEncounterEnabled is false', async () => {
            const campaign = { id: 10, currentLocationId: 1, travelEncounterEnabled: false };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const dice = { d20: vi.fn().mockReturnValue(20) };
            const combat = { startCombat: vi.fn() };
            const em = makeEm({ discovery, campaign });
            const service = new TravelService(em as never, null as never, dice as never, combat as never);
            const result = await service.travelTo(10, 2, 1);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.encounter).toBeNull();
            }

            expect(dice.d20).not.toHaveBeenCalled();
            expect(combat.startCombat).not.toHaveBeenCalled();
        });
    });

    describe('drawEncounterMonsters', () => {
        it('returns monsters within the CR bracket for the given character level', async () => {
            /* eslint-disable @typescript-eslint/naming-convention */
            const monsters = [
                { id: 1, name: 'Goblin', hit_points: 7, challenge_rating: 1 },
                { id: 2, name: 'Kobold', hit_points: 5, challenge_rating: 1 },
            ];
            /* eslint-enable @typescript-eslint/naming-convention */
            const em = makeEm({ monsters });
            const service = new TravelService(em as never, null as never);
            const result = await service.drawEncounterMonsters(4);
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result.length).toBeLessThanOrEqual(3);
            // Verify the query was called with the correct CR bracket for level 4 (bracket [1, 3])
            const connExecute = em.connExecuteRef;
            expect(connExecute).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([1, 3]),
                'all',
            );
        });

        it('returns an empty array when no monsters exist in the bracket', async () => {
            const em = makeEm({ monsters: [] });
            const service = new TravelService(em as never, null as never);
            const result = await service.drawEncounterMonsters(4);
            expect(result).toEqual([]);
        });

        it('clamps CR bracket to valid range at level 1', async () => {
            const em = makeEm({ monsters: [] });
            const service = new TravelService(em as never, null as never);
            await service.drawEncounterMonsters(1);
            const connExecute = em.connExecuteRef;
            const [, parameters] = connExecute.mock.calls[0] as [string, number[], string];
            // minCR should be clamped to 0 (floor(1/2)-1 = -1 → clamped to 0)
            expect(parameters[0]).toBe(0);
        });
    });

    describe('travelTo — NPC materialisation', () => {
        it('constructs temporary Npc entities from drawn SrdMonster entries', async () => {
            const campaign = { id: 10, currentLocationId: 1, travelEncounterEnabled: true };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const location = { id: 2, currentState: 'SAFE' };
            const character = { id: 5, level: 4, campaign: { id: 10 } };
            /* eslint-disable @typescript-eslint/naming-convention */
            const monsters = [{ id: 1, name: 'Goblin', hit_points: 7, challenge_rating: 0.25 }];
            /* eslint-enable @typescript-eslint/naming-convention */
            const dice = { d20: vi.fn().mockReturnValue(15) };
            const combat = { startCombat: vi.fn().mockResolvedValue({ success: true, data: {} }) };
            const em = makeEm({
                discovery, campaign, location, character, monsters,
            });
            const service = new TravelService(em as never, null as never, dice as never, combat as never);
            await service.travelTo(10, 2, 1);
            // em.create should have been called for the temp Npc
            const npcCreate = em.create.mock.calls.find(
                ([, data]) => (data as Record<string, unknown>).name === 'Goblin',
            );
            expect(npcCreate).toBeDefined();
            const npcData = npcCreate![1] as Record<string, unknown>;
            expect(npcData.hp).toBe(7);
            expect(npcData.maxHp).toBe(7);
        });

        it('calls CombatService.startCombat with player and temporary NPCs when encounter triggers', async () => {
            const campaign = { id: 10, currentLocationId: 1, travelEncounterEnabled: true };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const location = { id: 2, currentState: 'SAFE' };
            const character = { id: 5, level: 4, campaign: { id: 10 } };
            /* eslint-disable @typescript-eslint/naming-convention */
            const monsters = [
                { id: 1, name: 'Goblin', hit_points: 7, challenge_rating: 0.25 },
                { id: 2, name: 'Orc', hit_points: 15, challenge_rating: 0.5 },
            ];
            /* eslint-enable @typescript-eslint/naming-convention */
            const dice = { d20: vi.fn().mockReturnValue(15) };
            const combat = { startCombat: vi.fn().mockResolvedValue({ success: true, data: {} }) };
            const em = makeEm({
                discovery, campaign, location, character, monsters,
            });
            const service = new TravelService(em as never, null as never, dice as never, combat as never);
            await service.travelTo(10, 2, 1);
            expect(combat.startCombat).toHaveBeenCalledWith(
                1,
                expect.arrayContaining([
                    expect.objectContaining({ type: 'CHARACTER', id: '5' }),
                    expect.objectContaining({ type: 'NPC' }),
                    expect.objectContaining({ type: 'NPC' }),
                ]),
            );
        });
    });

    describe('discoverLocation', () => {
        it('creates a LocationDiscovery when not already discovered', async () => {
            const em = makeEm({ discovery: null });
            const service = new TravelService(em as never, null as never);
            const result = await service.discoverLocation(10, 5, 'EXPLORATION', null);
            expect(result.success).toBe(true);
            expect(em.create).toHaveBeenCalled();
            expect(em.persist).toHaveBeenCalled();
        });

        it('is idempotent when location already discovered', async () => {
            const discovery = { id: 1 };
            const em = makeEm({ discovery });
            const service = new TravelService(em as never, null as never);
            const result = await service.discoverLocation(10, 5, 'EXPLORATION', null);
            expect(result.success).toBe(true);
            expect(em.create).not.toHaveBeenCalled();
        });
    });

    describe('StateChangedEvent emissions', () => {
        it('travelTo emits TRAVEL event with locationId as entityId', async () => {
            const emitMock = vi.fn();
            const campaign = { id: 10, currentLocationId: 1 };
            const discovery = { id: 1, campaignId: 10, locationId: 5 };
            const em = makeEm({ campaign, discovery });
            const service = new TravelService(em as never, { emit: emitMock } as never);
            await service.travelTo(10, 5);
            expect(emitMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'TRAVEL', entityId: '5' }),
            );
        });
    });

    describe('createLocation', () => {
        it('creates a Location and auto-discovers it', async () => {
            const em = makeEm({ discovery: null });
            em.create.mockImplementation((_error: unknown, data: unknown) => ({ ...data as object, id: 42 }));
            const service = new TravelService(em as never, null as never);
            const result = await service.createLocation(10, {
                name: 'Dark Forest',
                description: 'A dense forest',
                currentState: null,
                connectedLocationIds: [],
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as { locationId: number }).locationId).toBeTruthy();
            }

            // Should have created both Location and LocationDiscovery
            expect(em.create).toHaveBeenCalledTimes(2);
        });
    });

    describe('updateCampaignSettings', () => {
        it('sets travelEncounterEnabled on the campaign', async () => {
            const campaign = { id: 10, travelEncounterEnabled: true };
            const em = makeEm({ campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.updateCampaignSettings(10, { travelEncounterEnabled: false });
            expect(result.success).toBe(true);
            expect(campaign.travelEncounterEnabled).toBe(false);
        });

        it('leaves campaign fields unchanged when empty payload is given', async () => {
            const campaign = { id: 10, travelEncounterEnabled: true };
            const em = makeEm({ campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.updateCampaignSettings(10, {});
            expect(result.success).toBe(true);
            expect(campaign.travelEncounterEnabled).toBe(true);
        });
    });
});
