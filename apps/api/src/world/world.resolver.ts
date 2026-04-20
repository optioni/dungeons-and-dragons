import {
    Args, ID, Query, Resolver,
} from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { createRelayConnection } from '../graphql/relay';
import { WorldConnectionArgs } from './args/world-connection.args.js';
import { Faction } from './entities/faction.entity.js';
import { Location } from './entities/location.entity.js';
import { Map } from './entities/map.entity.js';
import { Npc } from './entities/npc.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';
import { WorldService } from './world.service.js';

export const LocationConnection = createRelayConnection(Location);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type LocationConnection = InstanceType<typeof LocationConnection>;

export const MapConnection = createRelayConnection(Map);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type MapConnection = InstanceType<typeof MapConnection>;

export const FactionConnection = createRelayConnection(Faction);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FactionConnection = InstanceType<typeof FactionConnection>;

export const WorldEventConnection = createRelayConnection(WorldEvent);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type WorldEventConnection = InstanceType<typeof WorldEventConnection>;

export const NpcConnection = createRelayConnection(Npc);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type NpcConnection = InstanceType<typeof NpcConnection>;

/**
 * GraphQL resolver for owner-scoped world and NPC queries.
 * All operations require authentication via the global AuthGuard.
 */
@Resolver()
export class WorldResolver {
    constructor(
        private readonly worldService: WorldService,
        private readonly graphqlService: GraphqlService,
    ) {}

    @Query(() => LocationConnection)
    async locations(
        @Args() { campaignId, ...connArgs }: WorldConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Location>> {
        return this.worldService.getLocations(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => Location)
    async location(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<Location> {
        return this.worldService.findLocationById(Number(id), user.id);
    }

    @Query(() => MapConnection)
    async maps(
        @Args() { campaignId, ...connArgs }: WorldConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Map>> {
        return this.worldService.getMaps(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => FactionConnection)
    async factions(
        @Args() { campaignId, ...connArgs }: WorldConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Faction>> {
        return this.worldService.getFactions(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => WorldEventConnection)
    async worldEvents(
        @Args() { campaignId, ...connArgs }: WorldConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<WorldEvent>> {
        return this.worldService.getWorldEvents(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => WorldEvent)
    async worldEvent(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<WorldEvent> {
        return this.worldService.findWorldEventById(Number(id), user.id);
    }

    @Query(() => NpcConnection)
    async npcs(
        @Args() { campaignId, ...connArgs }: WorldConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Npc>> {
        return this.worldService.getNpcs(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => Npc)
    async npc(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<Npc> {
        return this.worldService.findNpcById(Number(id), user.id);
    }
}
