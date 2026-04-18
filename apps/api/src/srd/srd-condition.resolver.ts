import { Args, Query, Resolver } from '@nestjs/graphql';

import { ConnectionArgs, createRelayConnection } from '../graphql/relay';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdService } from './srd.service.js';

export const SrdConditionConnection = createRelayConnection(SrdCondition);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SrdConditionConnection = InstanceType<typeof SrdConditionConnection>;

@Resolver(() => SrdCondition)
export class SrdConditionResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdConditionConnection)
    async srdConditions(@Args() connArgs: ConnectionArgs): Promise<SrdConditionConnection> {
        return this.srdService.getConditions(connArgs);
    }

    @Query(() => SrdCondition, { nullable: true })
    async srdCondition(@Args('index') index: string): Promise<SrdCondition | null> {
        return this.srdService.getCondition(index);
    }
}
