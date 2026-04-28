import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
    Args, ID, Mutation, Query, ResolveField, Resolver, Root,
} from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { createRelayConnection } from '../graphql/relay';
import { Location } from '../world/entities/location.entity.js';
import { CampaignsConnectionArgs } from './args/campaigns-connection.args.js';
import { CampaignService } from './campaign.service.js';
import { CampaignSetupService } from './campaign.setup.service.js';
import { CreateCampaignInput } from './dto/create-campaign.input.js';
import { GenerateConceptsInput } from './dto/generate-concepts.input.js';
import { GenerateWorldSeedInput } from './dto/generate-world-seed.input.js';
import { SelectConceptInput } from './dto/select-concept.input.js';
import { Campaign } from './entities/campaign.entity.js';

export const CampaignConnection = createRelayConnection(Campaign);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CampaignConnection = InstanceType<typeof CampaignConnection>;

/**
 * GraphQL resolver for campaign management and setup mutations.
 * All operations require authentication via the global AuthGuard.
 */
@Resolver(() => Campaign)
export class CampaignResolver {
    constructor(
        private readonly campaignService: CampaignService,
        private readonly campaignSetupService: CampaignSetupService,
        private readonly graphqlService: GraphqlService,
        @InjectRepository(Location)
        private readonly locationRepository: EntityRepository<Location>,
    ) {}

    /** Creates a new draft campaign for the authenticated user. */
    @Mutation(() => Campaign)
    async createCampaign(
        @Args('input') input: CreateCampaignInput,
        @CurrentUser() user: User,
    ): Promise<Campaign> {
        return this.campaignService.create(input, user.id);
    }

    /** Returns all campaigns owned by the authenticated user as a relay connection. */
    @Query(() => CampaignConnection)
    async campaigns(
        @Args() args: CampaignsConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Campaign>> {
        return this.campaignService.findAll(user.id, args, this.graphqlService);
    }

    /** Returns a single campaign by ID. Throws if not found or not owned by user. */
    @Query(() => Campaign)
    async campaign(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<Campaign> {
        return this.campaignService.findById(Number(id), user.id);
    }

    /** Resolves the name of the campaign's current location, if one is set. */
    @ResolveField(() => String, { nullable: true })
    async currentLocationName(@Root() campaign: Campaign): Promise<string | null> {
        if (!campaign.currentLocationId) {
            return null;
        }

        const location = await this.locationRepository.findOne(campaign.currentLocationId);
        return location?.name ?? null;
    }

    /**
     * Resolves whether the campaign has an associated character.
     * Used by the setup wizard to determine whether to show character creation first.
     */
    @ResolveField(() => Boolean)
    async hasCharacter(@Root() campaign: Campaign): Promise<boolean> {
        const em = this.campaignService['campaignRepository'].getEntityManager();
        const count = await em.count('Character' as never, { campaign: { id: campaign.id } });
        return count > 0;
    }

    // ─── Setup mutations ────────────────────────────────────────────────────────

    /**
     * Step 1: Generates 3-4 story concepts and advances the campaign to CONCEPTS_GENERATED.
     * Requires a character to already exist on the campaign.
     */
    @Mutation(() => Campaign)
    async generateCampaignStoryConcepts(
        @Args('input') input: GenerateConceptsInput,
        @CurrentUser() user: User,
    ): Promise<Campaign> {
        return this.campaignSetupService.generateCampaignStoryConcepts(input, user.id);
    }

    /**
     * Step 2: Records the player's chosen concept index on the campaign.
     */
    @Mutation(() => Campaign)
    async selectCampaignStoryConcept(
        @Args('input') input: SelectConceptInput,
        @CurrentUser() user: User,
    ): Promise<Campaign> {
        return this.campaignSetupService.selectCampaignStoryConcept(input, user.id);
    }

    /**
     * Step 3: Generates and persists the full world seed, advancing the campaign to READY_TO_PLAY.
     * Idempotent — repeated calls for an already-seeded campaign return the existing state.
     */
    @Mutation(() => Campaign)
    async generateCampaignWorldSeed(
        @Args('input') input: GenerateWorldSeedInput,
        @CurrentUser() user: User,
    ): Promise<Campaign> {
        return this.campaignSetupService.generateCampaignWorldSeed(input, user.id);
    }
}
