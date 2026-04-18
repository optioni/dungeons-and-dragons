import {
    Args, ID, Mutation, Query, Resolver, Subscription,
} from '@nestjs/graphql';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { DmStreamChunk } from './dto/dm-stream-chunk.dto.js';
import { GameEvent } from './entities/game-event.entity.js';
import { GameSession } from './entities/game-session.entity.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';
import { type DmOrchestrator } from './dm-orchestrator.service.js';

/**
 * GraphQL resolver for session lifecycle, transcript queries, player input mutation,
 * and the DM stream subscription. All operations require authentication.
 */
@Resolver(() => GameSession)
export class SessionResolver {
    constructor(
        private readonly sessionService: SessionService,
        private readonly streamPublisher: StreamPublisher,
        private readonly dmOrchestrator: DmOrchestrator,
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
            throw new BadRequestException('Input must not be blank');
        }

        const session = await this.sessionService.findOwnedSession(Number(sessionId), user.id);

        if (session.endedAt) {
            throw new BadRequestException('Session is no longer active');
        }

        // Runs async — stream chunks are published via StreamPublisher
        void this.dmOrchestrator.runTurn(Number(sessionId), text);
        return true;
    }

    /**
     * Subscribes to the DM stream for an active session over SSE.
     * Non-owners receive no events.
     */
    @Subscription(() => DmStreamChunk)
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
