import { EntityManager } from '@mikro-orm/postgresql';
import { ForbiddenException } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { createRelayConnection } from '../graphql/relay';
import { OrderByDirection } from '../graphql/relay/order-by.input.js';
import { DiaryConnectionArgs } from './args/diary-connection.args.js';
import { DiaryEntry } from './entities/diary-entry.entity.js';

export const DiaryEntryConnection = createRelayConnection(DiaryEntry);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DiaryEntryConnection = InstanceType<typeof DiaryEntryConnection>;

/**
 * GraphQL resolver for player-safe diary entry reads. All queries are owner-scoped
 * and sorted newest-first. Embedding vectors are never exposed.
 */
@Resolver()
export class MemoryResolver {
    constructor(
        private readonly em: EntityManager,
        private readonly graphqlService: GraphqlService,
    ) {}

    /**
     * Returns a relay-paginated, owner-scoped list of diary entries for a campaign,
     * ordered newest-first. Non-owners receive a ForbiddenException.
     */
    @Query(() => DiaryEntryConnection)
    async diaryEntries(
        @Args() { campaignId, ...connArgs }: DiaryConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<DiaryEntry>> {
        const campaign = await this.em.findOne(Campaign, { id: Number(campaignId), userId: user.id });

        if (!campaign) {
            throw new ForbiddenException('Campaign not found or access denied');
        }

        const qb = this.em.getRepository(DiaryEntry).createQueryBuilder();
        return this.graphqlService.findAndPaginate(
            qb.andWhere({ campaign: { id: Number(campaignId) } }),
            undefined,
            [{ field: 'createdAt', direction: OrderByDirection.DESC }],
            connArgs,
        );
    }
}
