import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import {
    BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException, Optional,
} from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { GraphqlService } from '../graphql/graphql.service.js';
import { type ConnectionArgs } from '../graphql/relay';
import { SessionService } from '../session/session.service.js';
import { CampaignSetupStatus, CampaignStatus } from './campaign.enums.js';
import { type CreateCampaignInput } from './dto/create-campaign.input.js';
import { Campaign } from './entities/campaign.entity.js';

export const SESSION_SERVICE = Symbol('SESSION_SERVICE');

/**
 * Core campaign lifecycle service: creation, ownership-scoped lookups,
 * and the status-assertion helper used by setup mutations.
 */
@Injectable()
export class CampaignService {
    constructor(
        @InjectRepository(Campaign)
        private readonly campaignRepository: EntityRepository<Campaign>,
        @Optional()
        @Inject(forwardRef(() => SessionService))
        private readonly sessionService?: Pick<SessionService, 'endActiveSession'>,
    ) {}

    /**
     * Creates a draft campaign for the given user. No world entities are created yet.
     */
    async create(input: CreateCampaignInput, userId: number): Promise<Campaign> {
        const em = this.campaignRepository.getEntityManager();
        const campaign = em.create(Campaign, {
            userId,
            name: input.name,
        });
        em.persist(campaign);
        await em.flush();
        return campaign;
    }

    /**
     * Returns the campaign by ID, throwing NotFoundException if not found or not owned by the user.
     */
    async findById(id: number, userId: number): Promise<Campaign> {
        const em = this.campaignRepository.getEntityManager();
        const campaign = await em.findOne(Campaign, { id });

        if (!campaign || campaign.userId !== userId) {
            throw new NotFoundException('Campaign not found');
        }

        return campaign;
    }

    /**
     * Returns all campaigns owned by the given user as a relay connection.
     */
    async findAll(
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Campaign>> {
        const qb = this.campaignRepository.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ userId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /**
     * Verifies that a campaign exists and is owned by the given user.
     * @throws ForbiddenException if not found or owned by another user.
     */
    async verifyOwnership(campaignId: number, userId: number): Promise<Campaign> {
        const em = this.campaignRepository.getEntityManager();
        const campaign = await em.findOne(Campaign, { id: campaignId, userId });

        if (!campaign) {
            throw new ForbiddenException('Campaign not found or does not belong to you');
        }

        return campaign;
    }

    /**
     * Asserts that the campaign's current setup status is one of the allowed values.
     * @throws BadRequestException if the campaign is in an incompatible state.
     */
    assertStatus(campaign: Campaign, allowed: CampaignSetupStatus[]): void {
        if (!allowed.includes(campaign.setupStatus)) {
            throw new BadRequestException(
                `This action requires campaign status to be one of: ${allowed.join(', ')}. Current: ${campaign.setupStatus}`,
            );
        }
    }

    /**
     * Permanently marks a campaign as ENDED, stamps endedAt, persists endReason, then
     * force-ends the active session. Returns `{ alreadyEnded: true }` if the campaign
     * is already ENDED (structured error for LLM tool callers).
     */
    async endCampaign(
        campaignId: number,
        reason: string,
        _epitaph: string,
    ): Promise<{ alreadyEnded: true } | { ended: true }> {
        const em = this.campaignRepository.getEntityManager();
        const campaign = await em.findOne(Campaign, { id: campaignId });

        if (!campaign) {
            throw new NotFoundException('Campaign not found');
        }

        if (campaign.status === CampaignStatus.ENDED) {
            return { alreadyEnded: true };
        }

        campaign.status = CampaignStatus.ENDED;
        campaign.endedAt = new Date();
        campaign.endReason = reason;
        await em.flush();

        await this.sessionService?.endActiveSession(campaignId);

        return { ended: true };
    }
}
