// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { CampaignSetupStatus, CampaignStatus } from './campaign.enums';
import { CampaignService } from './campaign.service';
import { Campaign } from './entities/campaign.entity';

function makeMockRepo(overrides: Record<string, unknown> = {}) {
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
            findOne: vi.fn(),
            create: vi.fn(),
            persist: vi.fn(),
            flush: vi.fn(),
        }),
        ...overrides,
    };
}

function makeSessionService(): { endActiveSession: ReturnType<typeof vi.fn> } {
    return { endActiveSession: vi.fn().mockResolvedValue(undefined) };
}

describe('CampaignService', () => {
    let service: CampaignService;
    let mockRepo: ReturnType<typeof makeMockRepo>;
    let mockEm: {
        findOne: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
        persist: ReturnType<typeof vi.fn>
        flush: ReturnType<typeof vi.fn>
    };

    beforeEach(() => {
        mockRepo = makeMockRepo();
        mockEm = mockRepo.getEntityManager();
        service = new CampaignService(mockRepo as never);
    });

    describe('create', () => {
        it('creates a campaign with DRAFT status for the authenticated user', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                userId: 42,
                name: 'Test',
                setupStatus: CampaignSetupStatus.DRAFT,
            });

            mockEm.create.mockReturnValue(campaign);
            mockEm.flush.mockResolvedValue(undefined);

            const result = await service.create({ name: 'Test' }, 42);

            expect(mockEm.create).toHaveBeenCalledWith(Campaign, {
                userId: 42,
                name: 'Test',
            });
            expect(mockEm.persist).toHaveBeenCalledWith(campaign);
            expect(mockEm.flush).toHaveBeenCalled();
            expect(result.setupStatus).toBe(CampaignSetupStatus.DRAFT);
        });
    });

    describe('findById', () => {
        it('returns the campaign when the user owns it', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                userId: 42,
                name: 'Test',
                setupStatus: CampaignSetupStatus.DRAFT,
            });

            mockEm.findOne.mockResolvedValue(campaign);

            const result = await service.findById(1, 42);
            expect(result).toBe(campaign);
        });

        it('throws NotFoundException when campaign does not exist', async () => {
            mockEm.findOne.mockResolvedValue(null);
            await expect(service.findById(999, 42)).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when campaign belongs to another user', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                userId: 99,
                name: 'Test',
            });

            mockEm.findOne.mockResolvedValue(campaign);
            await expect(service.findById(1, 42)).rejects.toThrow(NotFoundException);
        });
    });

    describe('verifyOwnership', () => {
        it('returns the campaign when the user owns it', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, userId: 42 });
            mockEm.findOne.mockResolvedValue(campaign);

            const result = await service.verifyOwnership(1, 42);
            expect(result).toBe(campaign);
        });

        it('throws ForbiddenException when campaign does not belong to user', async () => {
            mockEm.findOne.mockResolvedValue(null);
            await expect(service.verifyOwnership(1, 42)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('setup status transitions', () => {
        it('assertStatus does not throw when current status matches expected', async () => {
            const campaign = Object.assign(new Campaign(), {
                setupStatus: CampaignSetupStatus.DRAFT,
            });

            expect(() => service.assertStatus(campaign, [CampaignSetupStatus.DRAFT])).not.toThrow();
        });

        it('assertStatus throws BadRequestException when status does not match', async () => {
            const { BadRequestException } = await import('@nestjs/common');
            const campaign = Object.assign(new Campaign(), {
                setupStatus: CampaignSetupStatus.READY_TO_PLAY,
            });

            expect(() => service.assertStatus(campaign, [CampaignSetupStatus.DRAFT])).toThrow(BadRequestException);
        });
    });

    describe('findById — status fields', () => {
        it('returns campaign with default ACTIVE status', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                userId: 42,
                name: 'Test',
                status: CampaignStatus.ACTIVE,
                endedAt: null,
                endReason: null,
            });

            mockEm.findOne.mockResolvedValue(campaign);

            const result = await service.findById(1, 42);
            expect(result.status).toBe(CampaignStatus.ACTIVE);
            expect(result.endedAt).toBeNull();
            expect(result.endReason).toBeNull();
        });
    });

    describe('endCampaign', () => {
        it('sets status to ENDED, stamps endedAt, persists endReason', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                status: CampaignStatus.ACTIVE,
                endedAt: null,
                endReason: null,
            });

            mockEm.findOne.mockResolvedValue(campaign);
            const sessionService = makeSessionService();
            service = new CampaignService(mockRepo as never, sessionService as never);

            const result = await service.endCampaign(1, 'Character died', 'A hero remembered.');

            expect(campaign.status).toBe(CampaignStatus.ENDED);
            expect(campaign.endedAt).toBeInstanceOf(Date);
            expect(campaign.endReason).toBe('Character died');
            expect(mockEm.flush).toHaveBeenCalled();
            expect(result).toEqual({ ended: true });
        });

        it('calls endActiveSession after persisting status', async () => {
            const campaign = Object.assign(new Campaign(), { id: 1, status: CampaignStatus.ACTIVE });
            mockEm.findOne.mockResolvedValue(campaign);
            const sessionService = makeSessionService();
            service = new CampaignService(mockRepo as never, sessionService as never);

            await service.endCampaign(1, 'reason', 'epitaph');

            expect(sessionService.endActiveSession).toHaveBeenCalledWith(1);
        });

        it('returns alreadyEnded when campaign is already ENDED', async () => {
            const campaign = Object.assign(new Campaign(), {
                id: 1,
                status: CampaignStatus.ENDED,
            });

            mockEm.findOne.mockResolvedValue(campaign);
            const sessionService = makeSessionService();
            service = new CampaignService(mockRepo as never, sessionService as never);

            const result = await service.endCampaign(1, 'reason', 'epitaph');

            expect(result).toEqual({ alreadyEnded: true });
            expect(sessionService.endActiveSession).not.toHaveBeenCalled();
        });
    });
});
