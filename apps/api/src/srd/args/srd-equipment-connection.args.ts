import { ArgsType, Field } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay';
import { SrdEquipmentWhereInput } from '../inputs/srd-equipment-where.input.js';

@ArgsType()
export class SrdEquipmentConnectionArgs extends ConnectionArgs {
    @Field(() => SrdEquipmentWhereInput, { nullable: true })
    where?: SrdEquipmentWhereInput;
}
