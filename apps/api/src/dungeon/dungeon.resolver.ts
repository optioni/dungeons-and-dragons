import {
    Args, ID, Query, Resolver,
} from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { createRelayConnection } from '../graphql/relay';
import { DungeonConnectionArgs } from './args/dungeon-connection.args.js';
import { RoomEncountersConnectionArgs } from './args/room-encounters-connection.args.js';
import { DungeonService } from './dungeon.service.js';
import { Dungeon } from './entities/dungeon.entity.js';
import { RoomEncounter } from './entities/room-encounter.entity.js';
import { RoomItem } from './entities/room-item.entity.js';

export const DungeonConnection = createRelayConnection(Dungeon);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DungeonConnection = InstanceType<typeof DungeonConnection>;

export const RoomEncounterConnection = createRelayConnection(RoomEncounter);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type RoomEncounterConnection = InstanceType<typeof RoomEncounterConnection>;

@Resolver()
export class DungeonResolver {
    constructor(
        private readonly dungeonService: DungeonService,
        private readonly graphqlService: GraphqlService,
    ) {}

    @Query(() => DungeonConnection)
    async dungeons(
        @Args() { campaignId, ...connArgs }: DungeonConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<Dungeon>> {
        return this.dungeonService.getDungeons(Number(campaignId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => RoomEncounterConnection)
    async roomEncounters(
        @Args() { dungeonId, ...connArgs }: RoomEncountersConnectionArgs,
        @CurrentUser() user: User,
    ): Promise<Connection<RoomEncounter>> {
        return this.dungeonService.getRoomEncounters(Number(dungeonId), user.id, connArgs, this.graphqlService);
    }

    @Query(() => [RoomItem])
    async roomItems(
        @Args('roomId', { type: () => ID }) roomId: string,
        @CurrentUser() user: User,
    ): Promise<RoomItem[]> {
        return this.dungeonService.getRoomItems(Number(roomId), user.id);
    }
}
