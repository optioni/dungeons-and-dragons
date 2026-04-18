import { Args, Query, Resolver } from '@nestjs/graphql';

import { ConnectionArgs, createRelayConnection } from '../graphql/relay';
import { SrdClass } from './entities/srd-class.entity.js';
import { SrdService } from './srd.service.js';

export const SrdClassConnection = createRelayConnection(SrdClass);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SrdClassConnection = InstanceType<typeof SrdClassConnection>;

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
