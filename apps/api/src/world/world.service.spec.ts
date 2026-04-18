// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { Campaign } from '../campaign/entities/campaign.entity';
import { Location } from './entities/location.entity';
import { Npc } from './entities/npc.entity';
import { WorldService } from './world.service';

function makeRepo(overrides: Record<string, unknown> = {}): ReturnType<typeof vi.fn> {
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
    } as unknown as ReturnType<typeof vi.fn>;
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
            makeRepo() as never, // mapRepo
            makeRepo() as never, // factionRepo
            makeRepo() as never, // worldEventRepo
            npcRepo as never,
            makeRepo() as never, // npcRelationshipRepo
            makeRepo() as never, // npcItemRepo
            campaignRepo as never,
        );
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
            campaignRepoEm.findOne.mockResolvedValue(null); // campaign not owned by user

            await expect(service.findNpcById(1, 42)).rejects.toThrow(NotFoundException);
        });
    });
});
