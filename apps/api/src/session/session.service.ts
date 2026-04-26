import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import {
    BadRequestException, forwardRef, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { CampaignService } from '../campaign/campaign.service.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { type ConnectionArgs, OrderByDirection } from '../graphql/relay';
import { GameEvent } from './entities/game-event.entity.js';
import { GameSession } from './entities/game-session.entity.js';
import { EventType, SceneType } from './session.enums.js';

const DEFAULT_GAME_EVENTS_PAGE_SIZE = 60;

/**
 * Owns GameSession and GameEvent persistence. All methods are owner-scoped —
 * callers supply a userId derived from the authenticated JWT.
 */
@Injectable()
export class SessionService {
    constructor(
        @InjectRepository(GameSession)
        private readonly sessionRepository: EntityRepository<GameSession>,
        @InjectRepository(GameEvent)
        private readonly eventRepository: EntityRepository<GameEvent>,
        @Inject(forwardRef(() => CampaignService))
        private readonly campaignService: CampaignService,
    ) {}

    /**
     * Starts a new session for the campaign. Enforces one-active-session-per-campaign.
     * Materializes `openingSceneSeed` into the first DM_NARRATIVE event only for the
     * very first session of the campaign.
     */
    async startSession(campaignId: number, userId: number): Promise<GameSession> {
        const campaign = await this.campaignService.verifyOwnership(campaignId, userId);
        const em = this.sessionRepository.getEntityManager();

        const existing = await em.findOne(GameSession, { campaign: campaignId, endedAt: null });
        if (existing) {
            return existing;
        }

        const session = em.create(GameSession, {
            campaign,
            sceneType: SceneType.EXPLORATION,
        });
        em.persist(session);
        await em.flush();

        const priorSessions = await em.count(GameSession, { campaign: campaignId, id: { $ne: session.id } });
        if (priorSessions === 0 && campaign.openingSceneSeed) {
            const event = em.create(GameEvent, {
                session,
                eventType: EventType.DM_NARRATIVE,
                content: { narrative: campaign.openingSceneSeed.narrativeHook },
            });
            em.persist(event);
            await em.flush();
        }

        return session;
    }

    /**
     * Ends an active session, setting endedAt to now. Throws if not found or not owned.
     */
    async endSession(sessionId: number, userId: number): Promise<GameSession> {
        const session = await this.findOwnedSession(sessionId, userId);

        if (session.endedAt) {
            throw new BadRequestException('Session is already ended');
        }

        session.endedAt = new Date();
        await this.sessionRepository.getEntityManager().flush();
        return session;
    }

    /**
     * Returns the active session for a campaign, or null if none exists. Owner-scoped.
     */
    async getActiveSession(campaignId: number, userId: number): Promise<GameSession | null> {
        await this.campaignService.verifyOwnership(campaignId, userId);
        const em = this.sessionRepository.getEntityManager();
        return em.findOne(GameSession, { campaign: campaignId, endedAt: null });
    }

    /**
     * Returns owner-scoped session events as a relay connection in chronological order.
     */
    async getGameEvents(
        sessionId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<GameEvent>> {
        await this.findOwnedSession(sessionId, userId);
        const qb = this.eventRepository.createQueryBuilder();
        const pageArgs = connArgs.first === undefined && connArgs.last === undefined
            ? { ...connArgs, last: DEFAULT_GAME_EVENTS_PAGE_SIZE }
            : connArgs;

        return graphqlService.findAndPaginate(
            qb.andWhere({ session: sessionId }),
            undefined,
            [{ field: 'createdAt', direction: OrderByDirection.ASC }],
            pageArgs,
        );
    }

    /**
     * Appends a typed event to a session. Internal — not exposed via GraphQL directly.
     */
    async appendEvent(sessionId: number, eventType: EventType, content: unknown): Promise<GameEvent> {
        const em = this.eventRepository.getEntityManager();
        const session = await em.findOneOrFail(GameSession, sessionId);
        const event = em.create(GameEvent, { session, eventType, content });
        em.persist(event);
        await em.flush();
        return event;
    }

    /**
     * Returns a session with its campaign populated. No auth — callers (orchestrator) are responsible.
     */
    async findSessionWithCampaign(sessionId: number): Promise<GameSession> {
        const em = this.sessionRepository.getEntityManager();
        return em.findOneOrFail(GameSession, sessionId, { populate: ['campaign'] });
    }

    /**
     * Updates the scene type on a session by ID. Does not perform auth — callers (tool handlers)
     * are responsible for ensuring the session is valid.
     */
    async updateSceneType(sessionId: number, sceneType: SceneType): Promise<GameSession> {
        const em = this.sessionRepository.getEntityManager();
        const session = await em.findOneOrFail(GameSession, sessionId);
        session.sceneType = sceneType;
        await em.flush();
        return session;
    }

    /**
     * Ends the active session for a campaign without requiring user interaction.
     * No-ops if no active session exists. Called by CampaignService.endCampaign.
     */
    async endActiveSession(campaignId: number): Promise<void> {
        const em = this.sessionRepository.getEntityManager();
        const session = await em.findOne(GameSession, { campaign: campaignId, endedAt: null });
        if (!session) {
            return;
        }

        session.endedAt = new Date();
        await em.flush();
    }

    /**
     * Retrieves a session and validates it belongs to the given user via campaign ownership.
     * @throws NotFoundException if the session does not exist or is unowned.
     */
    async findOwnedSession(sessionId: number, userId: number): Promise<GameSession> {
        const em = this.sessionRepository.getEntityManager();
        const session = await em.findOne(GameSession, sessionId, { populate: ['campaign'] });

        if (!session || session.campaign.userId !== userId) {
            throw new NotFoundException('Session not found');
        }

        return session;
    }
}
