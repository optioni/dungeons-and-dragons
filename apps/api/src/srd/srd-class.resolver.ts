import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { ConnectionArgs, createRelayConnection } from '../graphql/relay/index.js';
import { SrdClass } from './entities/srd-class.entity.js';
import { SrdService } from './srd.service.js';

export const SrdClassConnection = createRelayConnection(SrdClass);
export type SrdClassConnection = Connection<SrdClass>;

@Resolver(() => SrdClass)
export class SrdClassResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdClassConnection)
    async srdClasses(@Args() connArgs: ConnectionArgs): Promise<SrdClassConnection> {
        return this.srdService.getClasses(connArgs);
    }

    @Query(() => SrdClass, { nullable: true })
    async srdClass(@Args('index') index: string): Promise<SrdClass | null> {
        return this.srdService.getClass(index);
    }
}
