import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Connection } from 'graphql-relay';

import { ConnectionArgs, createRelayConnection } from '../graphql/relay/index.js';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdService } from './srd.service.js';

export const SrdConditionConnection = createRelayConnection(SrdCondition);
export type SrdConditionConnection = Connection<SrdCondition>;

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
