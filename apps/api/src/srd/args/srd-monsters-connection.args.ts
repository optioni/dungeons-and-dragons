import { ArgsType, Field } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay/index.js';
import { SrdMonsterWhereInput } from '../inputs/srd-monster-where.input.js';

@ArgsType()
export class SrdMonstersConnectionArgs extends ConnectionArgs {
    @Field(() => SrdMonsterWhereInput, { nullable: true })
    where?: SrdMonsterWhereInput;
}
