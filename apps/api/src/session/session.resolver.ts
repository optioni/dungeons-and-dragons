import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import {
    Args, ID, Mutation, Query, ResolveField, Resolver, Root, Subscription,
} from '@nestjs/graphql';

import { type User } from '../auth/entities/user.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { DmOrchestrator } from './dm-orchestrator.service.js';
import { DmStreamChunk } from './dto/dm-stream-chunk.dto.js';
import { GameEvent } from './entities/game-event.entity.js';
import { GameSession } from './entities/game-session.entity.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';

/**
 * GraphQL resolver for session lifecycle, transcript queries, player input mutation,
 * and the DM stream subscription. All operations require authentication.
 */
@Resolver(() => GameSession)
export class SessionResolver {
    private readonly logger = new Logger(SessionResolver.name);

    constructor(
        private readonly sessionService: SessionService,
        private readonly streamPublisher: StreamPublisher,
        private readonly dmOrchestrator: DmOrchestrator,
        private readonly em: EntityManager,
    ) {}

    /** Starts or resumes the active session for a campaign. */
    @Mutation(() => GameSession)
    async startSession(
        @Args('campaignId', { type: () => ID }) campaignId: string,
        @CurrentUser() user: User,
    ): Promise<GameSession> {
        return this.sessionService.startSession(Number(campaignId), user.id);
    }

    /** Ends the active session, preventing further player input. */
    @Mutation(() => GameSession)
    async endSession(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @CurrentUser() user: User,
    ): Promise<GameSession> {
        return this.sessionService.endSession(Number(sessionId), user.id);
    }

    /** Returns the active session for a campaign, or null if none. */
    @Query(() => GameSession, { nullable: true })
    async activeSession(
        @Args('campaignId', { type: () => ID }) campaignId: string,
        @CurrentUser() user: User,
    ): Promise<GameSession | null> {
        return this.sessionService.getActiveSession(Number(campaignId), user.id);
    }

    /** Returns all events for a session ordered oldest-first. */
    @Query(() => [GameEvent])
    async gameEvents(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @CurrentUser() user: User,
    ): Promise<GameEvent[]> {
        return this.sessionService.getGameEvents(Number(sessionId), user.id);
    }

    /** Resolves the active campaign character attached to the session, if one exists. */
    @ResolveField(() => ID, { nullable: true })
    async characterId(@Root() session: GameSession): Promise<number | null> {
        const character = await this.em.findOne(Character, { campaign: { id: session.campaignId } } as never);
        return character?.id ?? null;
    }

    /**
     * Accepts player input for an active session and triggers DM turn orchestration.
     * Validates non-blank input and active session state.
     */
    @Mutation(() => Boolean)
    async sendPlayerInput(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @Args('text') text: string,
        @CurrentUser() user: User,
    ): Promise<boolean> {
        if (!text.trim()) {
            this.logger.error(`Input rejected: sessionId=${sessionId} reason=blank_input`);
            throw new BadRequestException('Input must not be blank');
        }

        const session = await this.sessionService.findOwnedSession(Number(sessionId), user.id);

        if (session.endedAt) {
            this.logger.error(`Input rejected: sessionId=${sessionId} reason=session_ended`);
            throw new BadRequestException('Session is no longer active');
        }

        // Runs async — stream chunks are published via StreamPublisher
        void this.dmOrchestrator.runTurn(Number(sessionId), text);
        this.logger.log(`DM turn scheduled: sessionId=${sessionId} campaignId=${session.campaignId}`);
        return true;
    }

    /**
     * Subscribes to the DM stream for an active session over SSE.
     * Non-owners receive no events.
     */
    @Subscription(() => DmStreamChunk, { resolve: (value: DmStreamChunk) => value })
    async dmStream(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @CurrentUser() user: User,
    ): Promise<AsyncIterable<DmStreamChunk>> {
        const session = await this.sessionService.findOwnedSession(Number(sessionId), user.id);

        if (session.campaign.userId !== user.id) {
            throw new ForbiddenException('Not your session');
        }

        return this.streamPublisher.subscribe(Number(sessionId));
    }
}
