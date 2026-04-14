import { Field, InputType } from '@nestjs/graphql';

import { type RelayWhere } from '../../graphql/where.service.js';

@InputType()
export class SrdEquipmentWhereInput implements RelayWhere {
    @Field(() => String, { nullable: true })
    name_ilike?: string;

    @Field(() => String, { nullable: true })
    category_ilike?: string;

    @Field(() => [SrdEquipmentWhereInput], { nullable: true })
    AND?: SrdEquipmentWhereInput[];

    @Field(() => [SrdEquipmentWhereInput], { nullable: true })
    OR?: SrdEquipmentWhereInput[];
}
