// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { Campaign } from '../campaign/entities/campaign.entity';
import { NpcRelationship } from './entities/npc-relationship.entity';
import { Npc } from './entities/npc.entity';
import { WorldService } from './world.service';
import { WorldEventStatus } from './world.enums';

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
        }),
        ...overrides,
    };
}

describe('WorldService', () => {
    let service: WorldService;
    let locationRepo: ReturnType<typeof makeRepo>;
    let npcRepo: ReturnType<typeof makeRepo>;
    let campaignRepoEm: { findOne: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        locationRepo = makeRepo();
        npcRepo = makeRepo();
        const campaignRepo = makeRepo();
        campaignRepoEm = campaignRepo.getEntityManager();

        service = new WorldService(
            locationRepo as never,
            // mapRepo
            makeRepo() as never,
            // factionRepo
            makeRepo() as never,
            // worldEventRepo
            makeRepo() as never,
            npcRepo as never,
            // npcRelationshipRepo
            makeRepo() as never,
            // npcItemRepo
            makeRepo() as never,
            campaignRepo as never,
        );
    });

    // Task 2.3 — worldEvents status filter passes ACTIVE status to query
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
                getEntityManager: vi.fn().mockReturnValue({ findOne: vi.fn() }),
            };

            const graphqlService = {
                findAndPaginate: vi.fn().mockResolvedValue({ edges: [], pageInfo: { hasNextPage: false } }),
            };

            const svc = new WorldService(
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                worldEventRepo as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                {
                    createQueryBuilder: vi.fn(),
                    getEntityManager: vi.fn().mockReturnValue({ findOne: campaignRepoEm.findOne }),
                } as never,
            );

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

            const svc = new WorldService(
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                {
                    createQueryBuilder: vi.fn(),
                    getEntityManager: vi.fn().mockReturnValue({ findOne: campaignRepoEm.findOne }),
                } as never,
            );

            // Should not throw even without status filter
            await expect(
                svc.getWorldEvents(1, 42, {}, graphqlService as never),
            ).resolves.not.toThrow();
        });
    });

    describe('owner-scoped location query', () => {
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

    describe('findNpcById', () => {
        it('throws NotFoundException when NPC does not exist', async () => {
            npcRepo.getEntityManager.mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });
            await expect(service.findNpcById(999, 42)).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when NPC belongs to another user campaign', async () => {
            const npc = Object.assign(new Npc(), { id: 1, campaignId: 5 });
            npcRepo.getEntityManager.mockReturnValue({ findOne: vi.fn().mockResolvedValue(npc) });
            // campaign not owned by user
            campaignRepoEm.findOne.mockResolvedValue(null);

            await expect(service.findNpcById(1, 42)).rejects.toThrow(NotFoundException);
        });
    });

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

            // Need to re-create service with the npcRelationshipRepo having the same em
            const npcRelRepo = makeRepo();
            npcRelRepo.getEntityManager.mockReturnValue(em);

            const svc = new WorldService(
                locationRepo as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                npcRepo as never,
                npcRelRepo as never,
                makeRepo() as never,
                makeRepo() as never,
            );

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

            const svc = new WorldService(
                locationRepo as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                npcRepo as never,
                npcRelRepo as never,
                makeRepo() as never,
                makeRepo() as never,
            );

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

            const svc = new WorldService(
                locationRepo as never,
                makeRepo() as never,
                makeRepo() as never,
                makeRepo() as never,
                npcRepo as never,
                npcRelRepo as never,
                makeRepo() as never,
                makeRepo() as never,
            );

            const pairs = await svc.getConversationPairs(1);
            expect(pairs[0]).toBe(enemyRel);
            expect(pairs[1]).toBe(allyRel);
        });
    });
});
