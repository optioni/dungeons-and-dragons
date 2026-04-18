import { Args, Query, Resolver } from '@nestjs/graphql';

import { createRelayConnection } from '../graphql/relay';
import { SrdMonstersConnectionArgs } from './args/srd-monsters-connection.args.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdService } from './srd.service.js';

export const SrdMonsterConnection = createRelayConnection(SrdMonster);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SrdMonsterConnection = InstanceType<typeof SrdMonsterConnection>;

@Resolver(() => SrdMonster)
export class SrdMonsterResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdMonsterConnection)
    async srdMonsters(
        @Args() { where, ...connArgs }: SrdMonstersConnectionArgs,
    ): Promise<SrdMonsterConnection> {
        return this.srdService.getMonsters(connArgs, where);
    }

    @Query(() => SrdMonster, { nullable: true })
    async srdMonster(@Args('index') index: string): Promise<SrdMonster | null> {
        return this.srdService.getMonster(index);
    }
}
