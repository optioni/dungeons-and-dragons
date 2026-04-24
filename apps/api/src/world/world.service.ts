import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import {
    ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { type ConnectionArgs } from '../graphql/relay';
import { Faction } from './entities/faction.entity.js';
import { Location } from './entities/location.entity.js';
import { Map } from './entities/map.entity.js';
import { NpcItem } from './entities/npc-item.entity.js';
import { NpcRelationship } from './entities/npc-relationship.entity.js';
import { Npc } from './entities/npc.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';
import { NpcRelationshipType, WorldEventStatus } from './world.enums.js';

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
            qb.andWhere({ campaignId, dungeon: null }),
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

    /** Returns owner-scoped world events as a relay connection; optionally filtered by status. */
    async getWorldEvents(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
        status?: WorldEventStatus,
    ): Promise<Connection<WorldEvent>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.worldEventRepo.createQueryBuilder();
        const where: Record<string, unknown> = { campaignId };

        if (status !== undefined) {
            where['status'] = status;
        }

        return graphqlService.findAndPaginate(
            qb.andWhere(where),
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
    async findNpcById(
        id: number,
        userId: number,
    ): Promise<Npc & { relationships: NpcRelationship[]; items: NpcItem[] }> {
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

        const relEm = this.npcRelationshipRepo.getEntityManager();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const relationships = await relEm.find(NpcRelationship, { sourceNpcId: id });

        const itemEm = this.npcItemRepo.getEntityManager();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const items = await itemEm.find(NpcItem, { npcId: id });

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
     * Returns NPCs whose `nextTickInGameDay` is non-null and ≤ `inGameDay`,
     * ordered by ascending day, capped at `limit`. Used by the world tick worker.
     */
    async getDueNpcs(campaignId: number, inGameDay: number, limit: number): Promise<Npc[]> {
        const em = this.npcRepo.getEntityManager();
        return em.find(
            Npc,
            {
                campaignId,
                nextTickInGameDay: { $lte: inGameDay, $ne: null } as never,
            },
            { orderBy: { nextTickInGameDay: 'ASC' }, limit },
        );
    }

    /**
     * Returns NpcRelationship rows where both source and target NPCs share the same
     * `currentLocationId` within the campaign. Pairs are sorted by relationship priority
     * (ENEMY/RIVAL > ALLY/MENTOR/STUDENT/FAMILY > NEUTRAL), tiebroken by least-recently-conversed.
     */
    async getConversationPairs(campaignId: number): Promise<NpcRelationship[]> {
        const em = this.npcRelationshipRepo.getEntityManager();
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const allNpcs = await em.find(Npc, { campaignId });

        const npcByLocation: Record<number, Npc[]> = {};
        for (const npc of allNpcs) {
            if (npc.currentLocationId === null) {
                continue;
            }

            npcByLocation[npc.currentLocationId] ??= [];
            npcByLocation[npc.currentLocationId]!.push(npc);
        }

        const coLocatedNpcIds: number[] = [];
        for (const group of Object.values(npcByLocation)) {
            if (group.length >= 2) {
                for (const npc of group) {
                    coLocatedNpcIds.push(npc.id);
                }
            }
        }

        if (coLocatedNpcIds.length === 0) {
            return [];
        }

        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const relationships = await em.find(NpcRelationship, {
            $or: [
                { sourceNpcId: { $in: coLocatedNpcIds } },
                { targetNpcId: { $in: coLocatedNpcIds } },
            ],
        } as never);

        const npcById: Record<number, Npc> = Object.fromEntries(allNpcs.map((npc) => [npc.id, npc]));
        const qualifyingPairs = relationships.filter((rel) => {
            const sourceNpc = npcById[rel.sourceNpcId];
            const targetNpc = npcById[rel.targetNpcId];
            const sourceLoc = sourceNpc?.currentLocationId;
            const targetLoc = targetNpc?.currentLocationId;
            return (
                sourceLoc !== null
                && sourceLoc !== undefined
                && targetLoc !== null
                && targetLoc !== undefined
                && sourceLoc === targetLoc
            );
        });

        return qualifyingPairs.sort((a, b) => {
            const priority = (type: NpcRelationshipType): number => {
                if (type === NpcRelationshipType.ENEMY || type === NpcRelationshipType.RIVAL) {
                    return 0;
                }

                if (
                    type === NpcRelationshipType.ALLY
                    || type === NpcRelationshipType.MENTOR
                    || type === NpcRelationshipType.STUDENT
                    || type === NpcRelationshipType.FAMILY
                ) {
                    return 1;
                }

                // NEUTRAL
                return 2;
            };

            const priorityDiff = priority(a.type) - priority(b.type);
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // Tiebreak: least-recently-conversed first
            const sourceA = npcById[a.sourceNpcId];
            const sourceB = npcById[b.sourceNpcId];
            const timeA = sourceA?.lastConversedAt?.getTime() ?? 0;
            const timeB = sourceB?.lastConversedAt?.getTime() ?? 0;
            return timeA - timeB;
        });
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
