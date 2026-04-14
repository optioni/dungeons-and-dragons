import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { createRelayConnection } from '../graphql/relay/index.js';
import { SrdSpellsConnectionArgs } from './args/srd-spells-connection.args.js';
import { SrdSpell } from './entities/srd-spell.entity.js';
import { SrdService } from './srd.service.js';

export const SrdSpellConnection = createRelayConnection(SrdSpell);
export type SrdSpellConnection = Connection<SrdSpell>;

@Resolver(() => SrdSpell)
export class SrdSpellResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdSpellConnection)
    async srdSpells(
        @Args() { where, ...connArgs }: SrdSpellsConnectionArgs,
    ): Promise<SrdSpellConnection> {
        return this.srdService.getSpells(connArgs, where);
    }

    @Query(() => SrdSpell, { nullable: true })
    async srdSpell(@Args('index') index: string): Promise<SrdSpell | null> {
        return this.srdService.getSpell(index);
    }
}
