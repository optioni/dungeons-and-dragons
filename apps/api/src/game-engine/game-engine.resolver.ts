import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    Args, ID, Int, Mutation, Resolver,
} from '@nestjs/graphql';

import { type User } from '../auth/entities/user.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { LevelingService } from './leveling.service.js';

/** Exposes player-facing game-engine mutations (e.g. level-up confirmation). */
@Resolver()
export class GameEngineResolver {
    constructor(
        private readonly em: EntityManager,
        private readonly levelingService: LevelingService,
    ) {}

    /**
     * Applies the player's confirmed level-up choices.
     * Called from the frontend level-up panel after the LLM triggers level-up via tool call.
     */
    @Mutation(() => Boolean)
    async applyLevelUp(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @Args('hitPointsRolled', { type: () => Int }) hitPointsRolled: number,
        @Args('abilityScoreImprovements', { type: () => Object, nullable: true }) abilityScoreImprovements: Record<string, number> | null,
        @Args('feat', { nullable: true }) feat: string | null,
        @CurrentUser() _user: User,
    ): Promise<boolean> {
        const session = await this.em.findOne(GameSession, { id: Number(sessionId) }, { populate: ['campaign' as never] });
        if (!session) throw new NotFoundException('Session not found');

        const character = await this.em.findOne(Character, { campaign: { id: session.campaign.id } } as never);
        if (!character) throw new NotFoundException('Character not found');

        const result = await this.levelingService.applyLevelUp(
            Number(sessionId),
            character.id,
            {
                abilityScoreImprovements: abilityScoreImprovements ?? undefined,
                feat: feat ?? undefined,
            },
            hitPointsRolled,
        );

        if (!result.success) throw new BadRequestException(result.message);
        return true;
    }
}
