// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { SessionResolver } from './session.resolver.js';

describe('SessionResolver.sendPlayerInput', () => {
    let sessionService: Record<string, ReturnType<typeof vi.fn>>;
    let streamPublisher: Record<string, ReturnType<typeof vi.fn>>;
    let dmOrchestrator: Record<string, ReturnType<typeof vi.fn>>;
    let em: Record<string, ReturnType<typeof vi.fn>>;
    let resolver: SessionResolver;
    let mockSession: { endedAt: null | Date; lastInnerVoice: string | null; campaignId: number };

    beforeEach(() => {
        mockSession = { endedAt: null, lastInnerVoice: 'She mistrusts his stillness.', campaignId: 1 };
        sessionService = {
            findOwnedSession: vi.fn().mockResolvedValue(mockSession),
        };
        streamPublisher = {};
        dmOrchestrator = {
            runTurn: vi.fn().mockResolvedValue(undefined),
        };
        em = {
            flush: vi.fn().mockResolvedValue(undefined),
            findOne: vi.fn(),
        };

        resolver = new SessionResolver(
            sessionService as never,
            streamPublisher as never,
            dmOrchestrator as never,
            em as never,
            {} as never,
        );

        vi.spyOn(
            (resolver as unknown as { logger: { log: (...args: unknown[]) => void } }).logger,
            'log',
        ).mockImplementation(() => {});
    });

    it('clears lastInnerVoice to null and flushes before starting the DM turn', async () => {
        await resolver.sendPlayerInput('5', 'Check the sealed door', { id: 1 } as never);

        expect(mockSession.lastInnerVoice).toBeNull();
        expect(em.flush).toHaveBeenCalled();
    });

    it('flushes before calling dmOrchestrator.runTurn', async () => {
        const callOrder: string[] = [];
        em.flush.mockImplementation(async () => {
            callOrder.push('flush');
        });
        dmOrchestrator.runTurn.mockImplementation(async () => {
            callOrder.push('runTurn');
        });

        await resolver.sendPlayerInput('5', 'Go north', { id: 1 } as never);

        expect(callOrder[0]).toBe('flush');
    });
});
