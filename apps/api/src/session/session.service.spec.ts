// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { GameEvent } from './entities/game-event.entity';
import { GameSession } from './entities/game-session.entity';
import { EventType, SceneType } from './session.enums';
import { SessionService } from './session.service';

function makeMockEm(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
    return {
        findOne: vi.fn(),
        findOneOrFail: vi.fn(),
        count: vi.fn(),
        find: vi.fn(),
        create: vi.fn(),
        persist: vi.fn(),
        flush: vi.fn(),
        ...overrides,
    };
}

function makeMockRepo(em: ReturnType<typeof makeMockEm>): Record<string, unknown> {
    return {
        getEntityManager: vi.fn().mockReturnValue(em),
    };
}

function makeMockCampaignService(campaign: Record<string, unknown>): Record<string, ReturnType<typeof vi.fn>> {
    return {
        verifyOwnership: vi.fn().mockResolvedValue(campaign),
    };
}

describe('SessionService', () => {
    const userId = 1;
    const otherUserId = 2;
    const campaignId = 10;
    const sessionId = 20;

    const campaign = { id: campaignId, userId, openingSceneSeed: null };

    let em: ReturnType<typeof makeMockEm>;
    let sessionRepo: Record<string, unknown>;
    let eventRepo: Record<string, unknown>;
    let campaignService: ReturnType<typeof makeMockCampaignService>;
    let service: SessionService;

    beforeEach(() => {
        em = makeMockEm();
        sessionRepo = makeMockRepo(em);
        eventRepo = makeMockRepo(em);
        campaignService = makeMockCampaignService(campaign);
        service = new SessionService(
            sessionRepo as never,
            eventRepo as never,
            campaignService as never,
        );
    });

    describe('startSession', () => {
        it('creates a new EXPLORATION session when no active session exists', async () => {
            const session = Object.assign(
                new GameSession(), { id: sessionId, campaign, sceneType: SceneType.EXPLORATION },
            );
            // no existing active session
            em.findOne.mockResolvedValueOnce(null);
            em.create.mockReturnValue(session);
            em.flush.mockResolvedValue(undefined);
            // prior sessions exist (not first)
            em.count.mockResolvedValue(1);

            const result = await service.startSession(campaignId, userId);

            expect(campaignService.verifyOwnership).toHaveBeenCalledWith(campaignId, userId);
            expect(em.create).toHaveBeenCalledWith(GameSession, {
                campaign,
                sceneType: SceneType.EXPLORATION,
            });
            expect(result).toBe(session);
        });

        it('returns the existing active session without creating a new one', async () => {
            const existing = Object.assign(new GameSession(), { id: sessionId, campaign });
            em.findOne.mockResolvedValueOnce(existing);

            const result = await service.startSession(campaignId, userId);

            expect(em.create).not.toHaveBeenCalled();
            expect(result).toBe(existing);
        });

        it('materializes openingSceneSeed as DM_NARRATIVE event for the first session', async () => {
            const campaignWithSeed = {
                ...campaign,
                openingSceneSeed: { narrativeHook: 'You wake in the tavern...', locationDescription: '', initialTension: '' },
            };
            campaignService.verifyOwnership.mockResolvedValueOnce(campaignWithSeed);

            const session = Object.assign(new GameSession(), { id: sessionId, campaign: campaignWithSeed });
            const event = Object.assign(new GameEvent(), { id: 1 });

            em.findOne.mockResolvedValueOnce(null);
            em.create.mockReturnValueOnce(session).mockReturnValueOnce(event);
            em.flush.mockResolvedValue(undefined);
            // no prior sessions — this is the first
            em.count.mockResolvedValue(0);

            await service.startSession(campaignId, userId);

            expect(em.create).toHaveBeenCalledWith(GameEvent, {
                session,
                eventType: EventType.DM_NARRATIVE,
                content: { narrative: 'You wake in the tavern...' },
            });
        });

        it('does not materialize openingSceneSeed for subsequent sessions', async () => {
            const campaignWithSeed = {
                ...campaign,
                openingSceneSeed: { narrativeHook: 'Hook', locationDescription: '', initialTension: '' },
            };
            campaignService.verifyOwnership.mockResolvedValueOnce(campaignWithSeed);

            const session = Object.assign(new GameSession(), { id: sessionId });
            em.findOne.mockResolvedValueOnce(null);
            em.create.mockReturnValueOnce(session);
            em.flush.mockResolvedValue(undefined);
            // prior sessions exist
            em.count.mockResolvedValue(2);

            await service.startSession(campaignId, userId);

            // create was only called once (for the session, not for any event)
            expect(em.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('endSession', () => {
        it('sets endedAt and flushes', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId, userId },
                endedAt: null,
            });
            em.findOne.mockResolvedValueOnce(session);
            em.flush.mockResolvedValue(undefined);

            const result = await service.endSession(sessionId, userId);

            expect(result.endedAt).toBeInstanceOf(Date);
            expect(em.flush).toHaveBeenCalled();
        });

        it('throws BadRequestException if session is already ended', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId, userId },
                endedAt: new Date(),
            });
            em.findOne.mockResolvedValueOnce(session);

            await expect(service.endSession(sessionId, userId)).rejects.toThrow(BadRequestException);
        });

        it('throws NotFoundException if session is not owned by user', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId, userId: otherUserId },
                endedAt: null,
            });
            em.findOne.mockResolvedValueOnce(session);

            await expect(service.endSession(sessionId, userId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('getActiveSession', () => {
        it('returns the active session for a campaign', async () => {
            const session = Object.assign(new GameSession(), { id: sessionId });
            em.findOne.mockResolvedValueOnce(session);

            const result = await service.getActiveSession(campaignId, userId);

            expect(campaignService.verifyOwnership).toHaveBeenCalledWith(campaignId, userId);
            expect(result).toBe(session);
        });

        it('returns null when no active session exists', async () => {
            em.findOne.mockResolvedValueOnce(null);

            const result = await service.getActiveSession(campaignId, userId);

            expect(result).toBeNull();
        });

        it('throws ForbiddenException if campaign is not owned', async () => {
            campaignService.verifyOwnership.mockRejectedValueOnce(new ForbiddenException());

            await expect(service.getActiveSession(campaignId, userId)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('endActiveSession', () => {
        it('sets endedAt on the active session and flushes', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId },
                endedAt: null,
            });
            em.findOne.mockResolvedValueOnce(session);
            em.flush.mockResolvedValue(undefined);

            await service.endActiveSession(campaignId);

            expect(session.endedAt).toBeInstanceOf(Date);
            expect(em.flush).toHaveBeenCalled();
        });

        it('no-ops when no active session exists', async () => {
            em.findOne.mockResolvedValueOnce(null);

            await expect(service.endActiveSession(campaignId)).resolves.toBeUndefined();
            expect(em.flush).not.toHaveBeenCalled();
        });
    });

    describe('getGameEvents', () => {
        it('returns events for an owned session in chronological order', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId, userId },
                endedAt: null,
            });
            const events = [
                Object.assign(new GameEvent(), { id: 1, createdAt: new Date('2024-01-01') }),
                Object.assign(new GameEvent(), { id: 2, createdAt: new Date('2024-01-02') }),
            ];
            em.findOne.mockResolvedValueOnce(session);
            em.find.mockResolvedValueOnce(events);

            const result = await service.getGameEvents(sessionId, userId);

            expect(em.find).toHaveBeenCalledWith(
                GameEvent,
                { session: sessionId },
                { orderBy: { createdAt: 'ASC' } },
            );
            expect(result).toBe(events);
        });

        it('throws NotFoundException if session is not owned', async () => {
            const session = Object.assign(new GameSession(), {
                id: sessionId,
                campaign: { id: campaignId, userId: otherUserId },
            });
            em.findOne.mockResolvedValueOnce(session);

            await expect(service.getGameEvents(sessionId, userId)).rejects.toThrow(NotFoundException);
        });
    });
});
