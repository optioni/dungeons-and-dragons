import { ArgsType, Field } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay';
import { SrdMonsterWhereInput } from '../inputs/srd-monster-where.input.js';

@ArgsType()
export class SrdMonstersConnectionArgs extends ConnectionArgs {
    @Field(() => SrdMonsterWhereInput, { nullable: true })
    where?: SrdMonsterWhereInput;
}
