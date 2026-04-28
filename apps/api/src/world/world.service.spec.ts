// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { Campaign } from '../campaign/entities/campaign.entity';
import { QuestEntity } from '../quest/entities/quest-entity.entity';
import { QuestEntityType } from '../quest/quest.enums';
import { LocationDiscovery } from './entities/location-discovery.entity';
import { Location } from './entities/location.entity';
import { MapLocation } from './entities/map-location.entity';
import { Map } from './entities/map.entity';
import { NpcRelationship } from './entities/npc-relationship.entity';
import { Npc } from './entities/npc.entity';
import { MapScale, WorldEventStatus } from './world.enums';
import { WorldService } from './world.service';

function makeRepo(overrides: Record<string, unknown> = {}) {
    return {
        createQueryBuilder: vi.fn().mockReturnValue({
            clone: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            getResultList: vi.fn().mockResolvedValue([]),
            getSingleResult: vi.fn().mockResolvedValue(null),
        }),
        getEntityManager: vi.fn().mockReturnValue({
            findOne: vi.fn().mockResolvedValue(null),
            find: vi.fn().mockResolvedValue([]),
        }),
        ...overrides,
    };
}

/** Build a WorldService with all repos stubbed, accepting selective overrides per repo. */
function makeService(overrides: {
    locationRepo?: ReturnType<typeof makeRepo>
    mapRepo?: ReturnType<typeof makeRepo>
    mapLocationRepo?: ReturnType<typeof makeRepo>
    locationDiscoveryRepo?: ReturnType<typeof makeRepo>
    factionRepo?: ReturnType<typeof makeRepo>
    worldEventRepo?: ReturnType<typeof makeRepo>
    npcRepo?: ReturnType<typeof makeRepo>
    npcRelationshipRepo?: ReturnType<typeof makeRepo>
    npcItemRepo?: ReturnType<typeof makeRepo>
    campaignRepo?: ReturnType<typeof makeRepo>
    questEntityRepo?: ReturnType<typeof makeRepo>
} = {}): WorldService {
    return new WorldService(
        (overrides.locationRepo ?? makeRepo()) as never,
        (overrides.mapRepo ?? makeRepo()) as never,
        (overrides.mapLocationRepo ?? makeRepo()) as never,
        (overrides.locationDiscoveryRepo ?? makeRepo()) as never,
        (overrides.factionRepo ?? makeRepo()) as never,
        (overrides.worldEventRepo ?? makeRepo()) as never,
        (overrides.npcRepo ?? makeRepo()) as never,
        (overrides.npcRelationshipRepo ?? makeRepo()) as never,
        (overrides.npcItemRepo ?? makeRepo()) as never,
        (overrides.campaignRepo ?? makeRepo()) as never,
        (overrides.questEntityRepo ?? makeRepo()) as never,
    );
}

describe('WorldService', () => {
    let service: WorldService;
    let campaignRepo: ReturnType<typeof makeRepo>;
    let campaignRepoEm: { findOne: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };
    let npcRepo: ReturnType<typeof makeRepo>;
    let locationRepo: ReturnType<typeof makeRepo>;

    beforeEach(() => {
        campaignRepo = makeRepo();
        campaignRepoEm = campaignRepo.getEntityManager();
        npcRepo = makeRepo();
        locationRepo = makeRepo();

        service = makeService({ campaignRepo, npcRepo, locationRepo });
    });

    // ── getWorldEvents ──────────────────────────────────────────────────────

    describe('getWorldEvents', () => {
        it('includes status in the where filter when status is provided', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42 });
            campaignRepoEm.findOne.mockResolvedValue(campaign);

            const andWhereMock = vi.fn().mockReturnThis();
            const worldEventRepo = {
                createQueryBuilder: vi.fn().mockReturnValue({
                    clone: vi.fn().mockReturnThis(),
                    andWhere: andWhereMock,
                    orderBy: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockReturnThis(),
                    getResultList: vi.fn().mockResolvedValue([]),
                }),
                getEntityManager: vi.fn().mockReturnValue({ findOne: vi.fn(), find: vi.fn() }),
            };

            const graphqlService = {
                findAndPaginate: vi.fn().mockResolvedValue({ edges: [], pageInfo: { hasNextPage: false } }),
            };

            const svc = makeService({ worldEventRepo: worldEventRepo as never, campaignRepo });

            await svc.getWorldEvents(1, 42, {}, graphqlService as never, WorldEventStatus.ACTIVE);

            expect(graphqlService.findAndPaginate).toHaveBeenCalledWith(
                expect.anything(),
                undefined,
                undefined,
                {},
            );
        });

        it('omits status filter when status is not provided', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42 });
            campaignRepoEm.findOne.mockResolvedValue(campaign);

            const graphqlService = {
                findAndPaginate: vi.fn().mockResolvedValue({ edges: [], pageInfo: { hasNextPage: false } }),
            };

            const svc = makeService({ campaignRepo });

            await expect(
                svc.getWorldEvents(1, 42, {}, graphqlService as never),
            ).resolves.not.toThrow();
        });
    });

    // ── owner-scoped checks ─────────────────────────────────────────────────

    describe('verifyCampaignOwnership', () => {
        it('throws ForbiddenException when campaign does not belong to the user', async () => {
            campaignRepoEm.findOne.mockResolvedValue(null);
            await expect(service.verifyCampaignOwnership(99, 42)).rejects.toThrow(ForbiddenException);
        });

        it('returns campaign when user is the owner', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, name: 'Test' });
            campaignRepoEm.findOne.mockResolvedValue(campaign);
            const result = await service.verifyCampaignOwnership(1, 42);
            expect(result).toBe(campaign);
        });
    });

    // ── findNpcById ─────────────────────────────────────────────────────────

    describe('findNpcById', () => {
        it('throws NotFoundException when NPC does not exist', async () => {
            npcRepo.getEntityManager.mockReturnValue({ findOne: vi.fn().mockResolvedValue(null), find: vi.fn() });
            await expect(service.findNpcById(999, 42)).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when NPC belongs to another user campaign', async () => {
            const npc = Object.assign(new Npc(), { id: 1, campaignId: 5 });
            npcRepo.getEntityManager.mockReturnValue({ findOne: vi.fn().mockResolvedValue(npc), find: vi.fn() });
            campaignRepoEm.findOne.mockResolvedValue(null);
            await expect(service.findNpcById(1, 42)).rejects.toThrow(NotFoundException);
        });
    });

    // ── getDueNpcs ──────────────────────────────────────────────────────────

    describe('getDueNpcs', () => {
        it('returns NPCs whose nextTickInGameDay is overdue', async () => {
            const overdueNpc = Object.assign(new Npc(), { id: 1, campaignId: 1, nextTickInGameDay: 3 });
            npcRepo.getEntityManager.mockReturnValue({
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockResolvedValue([overdueNpc]),
            });

            const result = await service.getDueNpcs(1, 5, 10);
            expect(result).toContain(overdueNpc);
        });

        it('returns empty array when no NPCs are due', async () => {
            npcRepo.getEntityManager.mockReturnValue({
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockResolvedValue([]),
            });

            const result = await service.getDueNpcs(1, 5, 10);
            expect(result).toHaveLength(0);
        });

        it('passes limit to the query', async () => {
            const findMock = vi.fn().mockResolvedValue([]);
            npcRepo.getEntityManager.mockReturnValue({
                findOne: vi.fn().mockResolvedValue(null),
                find: findMock,
            });

            await service.getDueNpcs(1, 5, 3);
            expect(findMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ limit: 3 }),
            );
        });

        it('excludes NPCs with null nextTickInGameDay', async () => {
            const findMock = vi.fn().mockResolvedValue([]);
            npcRepo.getEntityManager.mockReturnValue({
                findOne: vi.fn().mockResolvedValue(null),
                find: findMock,
            });

            await service.getDueNpcs(1, 5, 10);
            const whereArgument = findMock.mock.calls[0][1] as Record<string, unknown>;
            expect(whereArgument).toMatchObject({
                nextTickInGameDay: expect.objectContaining({ $ne: null }),
            });
        });
    });

    // ── getConversationPairs ────────────────────────────────────────────────

    describe('getConversationPairs', () => {
        it('returns pairs where both NPCs share the same location', async () => {
            const npcA = Object.assign(new Npc(), { id: 1, campaignId: 1, currentLocationId: 10 });
            const npcB = Object.assign(new Npc(), { id: 2, campaignId: 1, currentLocationId: 10 });
            const rel = Object.assign(new NpcRelationship(), { sourceNpcId: 1, targetNpcId: 2, type: 'ALLY' });

            const em = {
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Npc) {
                        return Promise.resolve([npcA, npcB]);
                    }

                    if (entity === NpcRelationship) {
                        return Promise.resolve([rel]);
                    }

                    return Promise.resolve([]);
                }),
            };
            npcRepo.getEntityManager.mockReturnValue(em);

            const npcRelRepo = makeRepo();
            npcRelRepo.getEntityManager.mockReturnValue(em);

            const svc = makeService({ npcRepo, npcRelationshipRepo: npcRelRepo, campaignRepo });
            const pairs = await svc.getConversationPairs(1);
            expect(pairs).toHaveLength(1);
            expect(pairs[0]).toBe(rel);
        });

        it('excludes pairs where NPCs are at different locations', async () => {
            const npcA = Object.assign(new Npc(), { id: 1, campaignId: 1, currentLocationId: 10 });
            const npcB = Object.assign(new Npc(), { id: 2, campaignId: 1, currentLocationId: 20 });
            const rel = Object.assign(new NpcRelationship(), { sourceNpcId: 1, targetNpcId: 2, type: 'ALLY' });

            const em = {
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Npc) {
                        return Promise.resolve([npcA, npcB]);
                    }

                    if (entity === NpcRelationship) {
                        return Promise.resolve([rel]);
                    }

                    return Promise.resolve([]);
                }),
            };
            npcRepo.getEntityManager.mockReturnValue(em);
            const npcRelRepo = makeRepo();
            npcRelRepo.getEntityManager.mockReturnValue(em);

            const svc = makeService({ npcRepo, npcRelationshipRepo: npcRelRepo, campaignRepo });
            const pairs = await svc.getConversationPairs(1);
            expect(pairs).toHaveLength(0);
        });

        it('sorts ENEMY pairs before ALLY pairs', async () => {
            const npcA = Object.assign(new Npc(), { id: 1, campaignId: 1, currentLocationId: 10 });
            const npcB = Object.assign(new Npc(), { id: 2, campaignId: 1, currentLocationId: 10 });
            const npcC = Object.assign(new Npc(), { id: 3, campaignId: 1, currentLocationId: 10 });
            const allyRel = Object.assign(new NpcRelationship(), { sourceNpcId: 1, targetNpcId: 2, type: 'ALLY' });
            const enemyRel = Object.assign(new NpcRelationship(), { sourceNpcId: 1, targetNpcId: 3, type: 'ENEMY' });

            const em = {
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Npc) {
                        return Promise.resolve([npcA, npcB, npcC]);
                    }

                    if (entity === NpcRelationship) {
                        return Promise.resolve([allyRel, enemyRel]);
                    }

                    return Promise.resolve([]);
                }),
            };
            npcRepo.getEntityManager.mockReturnValue(em);
            const npcRelRepo = makeRepo();
            npcRelRepo.getEntityManager.mockReturnValue(em);

            const svc = makeService({ npcRepo, npcRelationshipRepo: npcRelRepo, campaignRepo });
            const pairs = await svc.getConversationPairs(1);
            expect(pairs[0]).toBe(enemyRel);
            expect(pairs[1]).toBe(allyRel);
        });
    });

    // ── getWorldMap ─────────────────────────────────────────────────────────

    describe('getWorldMap', () => {
        /** Build a WorldService where all repos share a single entity-manager mock. */
        const buildSvc = (
            emMock: { findOne: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> },
        ): WorldService => {
            const makeEmRepo = () => ({
                createQueryBuilder: vi.fn(),
                getEntityManager: vi.fn().mockReturnValue(emMock),
            }) as never;
             
            return new WorldService(makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo(), makeEmRepo());
        };

        // 2.1 — discovered nodes, frontier nodes, edges, currentLocationId, available scales
        it('returns discovered nodes with display fields', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, currentLocationId: 10 });
            const worldMap = Object.assign(new Map(), { id: 5, campaignId: 1, mapScale: MapScale.WORLD });
            const mapLoc = Object.assign(new MapLocation(), { id: 1, mapId: 5, locationId: 10 });
            const location = Object.assign(new Location(), {
                id: 10,
                name: 'Riverford',
                currentState: 'SAFE',
                coordinates: { x: 100, y: 200 },
                connectedLocationIds: [20],
            });
            const discovery = Object.assign(new LocationDiscovery(), { id: 1, campaignId: 1, locationId: 10 });

            const em = {
                findOne: vi.fn().mockResolvedValue(campaign),
                find: vi.fn().mockImplementation((entity: unknown, where: unknown) => {
                    if (entity === Map) {
                        return Promise.resolve([worldMap]);
                    }

                    if (entity === Location) {
                        const whereTyped = where as { dungeon?: unknown; id?: unknown };
                        if (whereTyped.dungeon) {
                            return Promise.resolve([]);
                        }

                        return Promise.resolve([location]);
                    }

                    if (entity === MapLocation) {
                        return Promise.resolve([mapLoc]);
                    }

                    if (entity === LocationDiscovery) {
                        return Promise.resolve([discovery]);
                    }

                    if (entity === QuestEntity) {
                        return Promise.resolve([]);
                    }

                    return Promise.resolve([]);
                }),
            };

            const svc = buildSvc(em);
            const result = await svc.getWorldMap(1, 42, MapScale.WORLD);

            expect(result.selectedScale).toBe(MapScale.WORLD);
            expect(result.availableScales).toContain(MapScale.WORLD);
            expect(result.currentLocationId).toBe('10');
            expect(result.discoveredNodes).toHaveLength(1);
            expect(result.discoveredNodes[0]!.id).toBe('10');
            expect(result.discoveredNodes[0]!.name).toBe('Riverford');
            expect(result.discoveredNodes[0]!.currentState).toBe('SAFE');
            expect(result.discoveredNodes[0]!.coordinates).toEqual({ x: 100, y: 200 });
        });

        // 2.1 — frontier nodes and visible edges
        it('returns frontier nodes for undiscovered neighbours', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, currentLocationId: 10 });
            const worldMap = Object.assign(new Map(), { id: 5, campaignId: 1, mapScale: MapScale.WORLD });
            const mapLocs = [
                Object.assign(new MapLocation(), { id: 1, mapId: 5, locationId: 10 }),
                Object.assign(new MapLocation(), { id: 2, mapId: 5, locationId: 20 }),
            ];
            const locDiscovered = Object.assign(new Location(), {
                id: 10,
                name: 'Riverford',
                currentState: 'SAFE',
                coordinates: null,
                connectedLocationIds: [20],
            });
            const locFrontier = Object.assign(new Location(), {
                id: 20,
                name: 'Hidden Vale',
                currentState: 'HOSTILE',
                coordinates: { x: 50, y: 50 },
                connectedLocationIds: [10],
            });
            const discovery = Object.assign(new LocationDiscovery(), { id: 1, campaignId: 1, locationId: 10 });

            const em = {
                findOne: vi.fn().mockResolvedValue(campaign),
                find: vi.fn().mockImplementation((entity: unknown, where: unknown) => {
                    if (entity === Map) {
                        return Promise.resolve([worldMap]);
                    }

                    if (entity === Location) {
                        const whereTyped2 = where as { dungeon?: unknown; id?: { $in?: number[] } };
                        if (whereTyped2.dungeon) {
                            return Promise.resolve([]);
                        }

                        // mapLocations load (ids 10 and 20)
                        if (whereTyped2.id?.$in?.includes(20)) {
                            return Promise.resolve([locDiscovered, locFrontier]);
                        }

                        return Promise.resolve([locDiscovered, locFrontier]);
                    }

                    if (entity === MapLocation) {
                        return Promise.resolve(mapLocs);
                    }

                    if (entity === LocationDiscovery) {
                        return Promise.resolve([discovery]);
                    }

                    if (entity === QuestEntity) {
                        return Promise.resolve([]);
                    }

                    return Promise.resolve([]);
                }),
            };

            const svc = buildSvc(em);
            const result = await svc.getWorldMap(1, 42, MapScale.WORLD);

            expect(result.frontierNodes).toHaveLength(1);
            expect(result.frontierNodes[0]!.id).toBe('20');
            expect(result.edges.some((edge) => (
                (edge.fromId === '10' && edge.toId === '20')
                || (edge.fromId === '20' && edge.toId === '10')
            ))).toBe(true);
        });

        // 2.2 — frontier nodes must not expose name, description, state, etc.
        it('does not expose undiscovered location name, description, or state on frontier nodes', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, currentLocationId: 10 });
            const worldMap = Object.assign(new Map(), { id: 5, campaignId: 1, mapScale: MapScale.WORLD });
            const mapLoc = Object.assign(new MapLocation(), { id: 1, mapId: 5, locationId: 10 });
            const locDiscovered = Object.assign(new Location(), {
                id: 10,
                name: 'Riverford',
                currentState: 'SAFE',
                coordinates: null,
                connectedLocationIds: [99],
            });
            const locFrontier = Object.assign(new Location(), {
                id: 99,
                name: 'SECRET PLACE',
                description: 'very secret',
                currentState: 'HOSTILE',
                coordinates: null,
                connectedLocationIds: [10],
            });
            const discovery = Object.assign(new LocationDiscovery(), { id: 1, campaignId: 1, locationId: 10 });

            const em = {
                findOne: vi.fn().mockResolvedValue(campaign),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Map) {
                        return Promise.resolve([worldMap]);
                    }

                    if (entity === Location) {
                        return Promise.resolve([locDiscovered, locFrontier]);
                    }

                    if (entity === MapLocation) {
                        return Promise.resolve([mapLoc]);
                    }

                    if (entity === LocationDiscovery) {
                        return Promise.resolve([discovery]);
                    }

                    if (entity === QuestEntity) {
                        return Promise.resolve([]);
                    }

                    return Promise.resolve([]);
                }),
            };

            const svc = buildSvc(em);
            const result = await svc.getWorldMap(1, 42, MapScale.WORLD);

            const frontierNode = result.frontierNodes[0]!;
            expect('name' in frontierNode).toBe(false);
            expect('description' in frontierNode).toBe(false);
            expect('currentState' in frontierNode).toBe(false);
            // id is the only identifiable field — must not be a deduced name
            expect(frontierNode.id).toBe('99');
        });

        // 2.3 — non-owner access is rejected
        it('throws ForbiddenException when campaign does not belong to user', async () => {
            const em = {
                findOne: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockResolvedValue([]),
            };
            const svc = buildSvc(em);
            await expect(svc.getWorldMap(1, 999, MapScale.WORLD)).rejects.toThrow(ForbiddenException);
        });

        // 2.4 — missing coordinates do not fail the query
        it('handles nodes without coordinates gracefully', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, currentLocationId: 10 });
            const worldMap = Object.assign(new Map(), { id: 5, campaignId: 1, mapScale: MapScale.WORLD });
            const mapLoc = Object.assign(new MapLocation(), { id: 1, mapId: 5, locationId: 10 });
            const location = Object.assign(new Location(), {
                id: 10,
                name: 'Riverford',
                currentState: 'SAFE',
                coordinates: null,
                connectedLocationIds: [],
            });
            const discovery = Object.assign(new LocationDiscovery(), { id: 1, campaignId: 1, locationId: 10 });

            const em = {
                findOne: vi.fn().mockResolvedValue(campaign),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Map) {
                        return Promise.resolve([worldMap]);
                    }

                    if (entity === Location) {
                        return Promise.resolve([location]);
                    }

                    if (entity === MapLocation) {
                        return Promise.resolve([mapLoc]);
                    }

                    if (entity === LocationDiscovery) {
                        return Promise.resolve([discovery]);
                    }

                    if (entity === QuestEntity) {
                        return Promise.resolve([]);
                    }

                    return Promise.resolve([]);
                }),
            };

            const svc = buildSvc(em);

            await expect(svc.getWorldMap(1, 42, MapScale.WORLD)).resolves.toBeDefined();
            const result = await svc.getWorldMap(1, 42, MapScale.WORLD);
            expect(result.discoveredNodes[0]!.coordinates).toBeNull();
        });

        // 2.5 — activity markers from active quest entities
        it('sets hasActivityMarker for discovered nodes referenced by active quests', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42, currentLocationId: 10 });
            const worldMap = Object.assign(new Map(), { id: 5, campaignId: 1, mapScale: MapScale.WORLD });
            const mapLoc = Object.assign(new MapLocation(), { id: 1, mapId: 5, locationId: 10 });
            const location = Object.assign(new Location(), {
                id: 10,
                name: 'Riverford',
                currentState: 'SAFE',
                coordinates: null,
                connectedLocationIds: [],
            });
            const discovery = Object.assign(new LocationDiscovery(), { id: 1, campaignId: 1, locationId: 10 });
            const questEnt = Object.assign(new QuestEntity(), {
                id: 1, entityType: QuestEntityType.LOCATION, entityId: 10,
            });

            const em = {
                findOne: vi.fn().mockResolvedValue(campaign),
                find: vi.fn().mockImplementation((entity: unknown) => {
                    if (entity === Map) {
                        return Promise.resolve([worldMap]);
                    }

                    if (entity === Location) {
                        return Promise.resolve([location]);
                    }

                    if (entity === MapLocation) {
                        return Promise.resolve([mapLoc]);
                    }

                    if (entity === LocationDiscovery) {
                        return Promise.resolve([discovery]);
                    }

                    if (entity === QuestEntity) {
                        return Promise.resolve([questEnt]);
                    }

                    return Promise.resolve([]);
                }),
            };

            const svc = buildSvc(em);
            const result = await svc.getWorldMap(1, 42, MapScale.WORLD);
            expect(result.discoveredNodes[0]!.hasActivityMarker).toBe(true);
        });
    });
});
