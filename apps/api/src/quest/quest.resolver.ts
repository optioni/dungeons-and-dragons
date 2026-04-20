import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import {
    ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { type User } from '../auth/entities/user.entity.js';
import { Campaign } from '../campaign/entities/campaign.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { ConnectionArgs, createRelayConnection } from '../graphql/relay';
import { Quest } from './entities/quest.entity.js';
import { QuestStatus } from './quest.enums.js';

export const QuestConnection = createRelayConnection(Quest);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type QuestConnection = InstanceType<typeof QuestConnection>;

/**
 * GraphQL resolver for owner-scoped quest queries.
 * All operations require authentication via the global AuthGuard.
 */
@Resolver()
export class QuestResolver {
    constructor(
        private readonly em: EntityManager,
        @InjectRepository(Quest)
        private readonly questRepo: EntityRepository<Quest>,
        @InjectRepository(Campaign)
        private readonly campaignRepo: EntityRepository<Campaign>,
        private readonly graphqlService: GraphqlService,
    ) {}

    /** Returns relay-paginated quests for a campaign, optionally filtered by status. */
    @Query(() => QuestConnection)
    async quests(
        @Args('campaignId', { type: () => ID }) campaignId: string,
        @Args('status', { type: () => QuestStatus, nullable: true }) status: QuestStatus | undefined,
        @Args() connArgs: ConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Quest>> {
        await this.verifyCampaignOwnership(Number(campaignId), user.id);

        const qb = this.questRepo.createQueryBuilder();
        qb.andWhere({ campaignId: Number(campaignId) });
        if (status !== undefined) {
            qb.andWhere({ status });
        }

        return this.graphqlService.findAndPaginate(qb, undefined, undefined, connArgs);
    }

    /** Returns a single quest with objectives and linked entities. */
    @Query(() => Quest)
    async quest(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<Quest> {
        const found = await this.questRepo.findOne(Number(id));
        if (!found) {
            throw new NotFoundException(`Quest ${id} not found`);
        }

        await this.verifyCampaignOwnership(found.campaignId, user.id);
        await this.em.populate(found, ['objectives', 'entities']);

        return found;
    }

    private async verifyCampaignOwnership(campaignId: number, userId: number): Promise<void> {
        const campaign = await this.campaignRepo.findOne({ id: campaignId, userId });
        if (!campaign) {
            throw new ForbiddenException('Campaign not found or access denied');
        }
    }
}
