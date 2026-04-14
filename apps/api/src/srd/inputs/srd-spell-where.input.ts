import { Field, InputType, Int } from '@nestjs/graphql';

import { type RelayWhere } from '../../graphql/where.service.js';

@InputType()
export class SrdSpellWhereInput implements RelayWhere {
    @Field(() => String, { nullable: true })
    name_ilike?: string;

    @Field(() => Int, { nullable: true })
    level?: number;

    @Field(() => String, { nullable: true })
    school_ilike?: string;

    @Field(() => [SrdSpellWhereInput], { nullable: true })
    AND?: SrdSpellWhereInput[];

    @Field(() => [SrdSpellWhereInput], { nullable: true })
    OR?: SrdSpellWhereInput[];
}
