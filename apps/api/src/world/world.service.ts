import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import {
    ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { type ConnectionArgs } from '../graphql/relay/index.js';
import { Faction } from './entities/faction.entity.js';
import { Location } from './entities/location.entity.js';
import { Map } from './entities/map.entity.js';
import { Npc } from './entities/npc.entity.js';
import { NpcItem } from './entities/npc-item.entity.js';
import { NpcRelationship } from './entities/npc-relationship.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';

/**
 * Service for reading world and NPC data. All list queries are owner-scoped:
 * the caller must supply a campaignId that belongs to the authenticated user.
 */
@Injectable()
export class WorldService {
    constructor(
        @InjectRepository(Location)
        private readonly locationRepo: EntityRepository<Location>,
        @InjectRepository(Map)
        private readonly mapRepo: EntityRepository<Map>,
        @InjectRepository(Faction)
        private readonly factionRepo: EntityRepository<Faction>,
        @InjectRepository(WorldEvent)
        private readonly worldEventRepo: EntityRepository<WorldEvent>,
        @InjectRepository(Npc)
        private readonly npcRepo: EntityRepository<Npc>,
        @InjectRepository(NpcRelationship)
        private readonly npcRelationshipRepo: EntityRepository<NpcRelationship>,
        @InjectRepository(NpcItem)
        private readonly npcItemRepo: EntityRepository<NpcItem>,
        @InjectRepository(Campaign)
        private readonly campaignRepo: EntityRepository<Campaign>,
    ) {}

    /**
     * Verifies that the campaign exists and is owned by userId.
     * @throws ForbiddenException if not found or access denied.
     */
    async verifyCampaignOwnership(campaignId: number, userId: number): Promise<Campaign> {
        const em = this.campaignRepo.getEntityManager();
        const campaign = await em.findOne(Campaign, { id: campaignId, userId });

        if (!campaign) {
            throw new ForbiddenException('Campaign not found or access denied');
        }

        return campaign;
    }

    /** Returns owner-scoped locations as a relay connection. */
    async getLocations(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Location>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.locationRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ campaignId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /** Returns owner-scoped maps as a relay connection. */
    async getMaps(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Map>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.mapRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ campaignId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /** Returns owner-scoped factions as a relay connection. */
    async getFactions(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Faction>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.factionRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ campaignId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /** Returns owner-scoped world events as a relay connection. */
    async getWorldEvents(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<WorldEvent>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.worldEventRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ campaignId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /** Returns owner-scoped NPCs as a relay connection. */
    async getNpcs(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Npc>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.npcRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(
            qb.andWhere({ campaignId }),
            undefined,
            undefined,
            connArgs,
        );
    }

    /**
     * Returns a single NPC with relationships and inventory, verifying campaign ownership.
     * @throws NotFoundException if not found or access denied.
     */
    async findNpcById(id: number, userId: number): Promise<Npc & { relationships: NpcRelationship[]; items: NpcItem[] }> {
        const em = this.npcRepo.getEntityManager();
        const npc = await em.findOne(Npc, { id });

        if (!npc) {
            throw new NotFoundException('NPC not found');
        }

        const campaign = await this.campaignRepo.getEntityManager().findOne(
            Campaign,
            { id: npc.campaignId, userId },
        );

        if (!campaign) {
            throw new NotFoundException('NPC not found');
        }

        const relationships = await this.npcRelationshipRepo.getEntityManager().find(
            NpcRelationship,
            { sourceNpcId: id },
        );

        const items = await this.npcItemRepo.getEntityManager().find(
            NpcItem,
            { npcId: id },
        );

        return Object.assign(npc, { relationships, items });
    }

    /**
     * Returns a single Location, verifying the campaign belongs to the user.
     * @throws NotFoundException if not found or access denied.
     */
    async findLocationById(id: number, userId: number): Promise<Location> {
        const em = this.locationRepo.getEntityManager();
        const location = await em.findOne(Location, { id });

        if (!location) {
            throw new NotFoundException('Location not found');
        }

        const campaign = await this.campaignRepo.getEntityManager().findOne(
            Campaign,
            { id: location.campaignId, userId },
        );

        if (!campaign) {
            throw new NotFoundException('Location not found');
        }

        return location;
    }

    /**
     * Returns a single WorldEvent, verifying the campaign belongs to the user.
     */
    async findWorldEventById(id: number, userId: number): Promise<WorldEvent> {
        const em = this.worldEventRepo.getEntityManager();
        const event = await em.findOne(WorldEvent, { id });

        if (!event) {
            throw new NotFoundException('World event not found');
        }

        const campaign = await this.campaignRepo.getEntityManager().findOne(
            Campaign,
            { id: event.campaignId, userId },
        );

        if (!campaign) {
            throw new NotFoundException('World event not found');
        }

        return event;
    }
}
