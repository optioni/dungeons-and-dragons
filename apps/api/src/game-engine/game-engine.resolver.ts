import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    Args, Field, ID, InputType, Int, Mutation, Resolver,
} from '@nestjs/graphql';

import { type User } from '../auth/entities/user.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { LevelingService } from './leveling.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
@InputType()
class AbilityScoreImprovementsInput {
    @Field(() => Int, { nullable: true })
    STR?: number;

    @Field(() => Int, { nullable: true })
    DEX?: number;

    @Field(() => Int, { nullable: true })
    CON?: number;

    @Field(() => Int, { nullable: true })
    INT?: number;

    @Field(() => Int, { nullable: true })
    WIS?: number;

    @Field(() => Int, { nullable: true })
    CHA?: number;
}
/* eslint-enable @typescript-eslint/naming-convention */

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
        @Args('abilityScoreImprovements', { type: () => AbilityScoreImprovementsInput, nullable: true }) abilityScoreImprovements: AbilityScoreImprovementsInput | null,
        @Args('feat', { type: () => String, nullable: true }) feat: string | null,
        @CurrentUser() currentUser: User,
    ): Promise<boolean> {
        void currentUser;
        const session = await this.em.findOne(GameSession, { id: Number(sessionId) }, { populate: ['campaign' as never] });
        if (!session) {
            throw new NotFoundException('Session not found');
        }

        const character = await this.em.findOne(Character, { campaign: { id: session.campaign.id } } as never);
        if (!character) {
            throw new NotFoundException('Character not found');
        }

        const cleanAbilityScoreImprovements = abilityScoreImprovements === null
            ? undefined
            : Object.fromEntries(
                Object.entries(abilityScoreImprovements).filter(([, increment]) => typeof increment === 'number'),
            ) as Record<string, number>;

        const result = await this.levelingService.applyLevelUp(
            Number(sessionId),
            character.id,
            {
                abilityScoreImprovements: cleanAbilityScoreImprovements,
                feat: feat ?? undefined,
            },
            hitPointsRolled,
        );

        if (!result.success) {
            throw new BadRequestException(result.message);
        }

        return true;
    }

    /**
     * Applies the player's prepared-spell selection for the active session
     * character after the DM has paused freeform play.
     */
    @Mutation(() => Boolean)
    async prepareSpells(
        @Args('sessionId', { type: () => ID }) sessionId: string,
        @Args('spells', { type: () => [String] }) spells: string[],
        @CurrentUser() currentUser: User,
    ): Promise<boolean> {
        void currentUser;
        const session = await this.em.findOne(GameSession, { id: Number(sessionId) }, { populate: ['campaign' as never] });
        if (!session) {
            throw new NotFoundException('Session not found');
        }

        const character = await this.em.findOne(Character, { campaign: { id: session.campaign.id } } as never);
        if (!character) {
            throw new NotFoundException('Character not found');
        }

        const result = await this.levelingService.prepareSpells(character.id, spells);
        if (!result.success) {
            throw new BadRequestException(result.message);
        }

        return true;
    }
}
