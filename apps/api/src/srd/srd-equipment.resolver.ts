import { Args, Query, Resolver } from '@nestjs/graphql';

import { createRelayConnection } from '../graphql/relay';
import { SrdEquipmentConnectionArgs } from './args/srd-equipment-connection.args.js';
import { SrdEquipment } from './entities/srd-equipment.entity.js';
import { SrdService } from './srd.service.js';

export const SrdEquipmentConnection = createRelayConnection(SrdEquipment);
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SrdEquipmentConnection = InstanceType<typeof SrdEquipmentConnection>;

@Resolver(() => SrdEquipment)
export class SrdEquipmentResolver {
    constructor(private readonly srdService: SrdService) {}

    @Query(() => SrdEquipmentConnection)
    async srdEquipment(
        @Args() { where, ...connArgs }: SrdEquipmentConnectionArgs,
    ): Promise<SrdEquipmentConnection> {
        return this.srdService.getEquipment(connArgs, where);
    }

    @Query(() => SrdEquipment, { nullable: true })
    async srdEquipmentItem(@Args('index') index: string): Promise<SrdEquipment | null> {
        return this.srdService.getEquipmentItem(index);
    }
}
