import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { createRelayConnection } from '../graphql/relay/index.js';
import { SrdMonstersConnectionArgs } from './args/srd-monsters-connection.args.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdService } from './srd.service.js';

export const SrdMonsterConnection = createRelayConnection(SrdMonster);
export type SrdMonsterConnection = Connection<SrdMonster>;

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
