import { Args, Query, Resolver } from '@nestjs/graphql';

import { ConnectionArgs, createRelayConnection } from '../graphql/relay';
import { SrdRace } from './entities/srd-race.entity.js';
import { SrdService } from './srd.service.js';

export const SrdRaceConnection = createRelayConnection(SrdRace);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SrdRaceConnection = InstanceType<typeof SrdRaceConnection>;

@Resolver(() => SrdRace)
export class SrdRaceResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdRaceConnection)
    async srdRaces(@Args() connArgs: ConnectionArgs): Promise<SrdRaceConnection> {
        return this.srdService.getRaces(connArgs);
    }

    @Query(() => SrdRace, { nullable: true })
    async srdRace(@Args('index') index: string): Promise<SrdRace | null> {
        return this.srdService.getRace(index);
    }
}
