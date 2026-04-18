import { Field, Float, InputType } from '@nestjs/graphql';

import { type RelayWhere } from '../../graphql/where.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
@InputType()
export class SrdMonsterWhereInput implements RelayWhere {
    @Field(() => String, { nullable: true })
    name_ilike?: string;

    @Field(() => Float, { nullable: true })
    challengeRating_gte?: number;

    @Field(() => Float, { nullable: true })
    challengeRating_lte?: number;

    @Field(() => [SrdMonsterWhereInput], { nullable: true })
    AND?: SrdMonsterWhereInput[];

    @Field(() => [SrdMonsterWhereInput], { nullable: true })
    OR?: SrdMonsterWhereInput[];
}
/* eslint-enable @typescript-eslint/naming-convention */
