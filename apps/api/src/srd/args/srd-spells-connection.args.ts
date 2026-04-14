import { ArgsType, Field } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay/index.js';
import { SrdSpellWhereInput } from '../inputs/srd-spell-where.input.js';

@ArgsType()
export class SrdSpellsConnectionArgs extends ConnectionArgs {
    @Field(() => SrdSpellWhereInput, { nullable: true })
    where?: SrdSpellWhereInput;
}
