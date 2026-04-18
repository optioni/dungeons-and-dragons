import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

import { ConnectionArgs } from '../../graphql/relay/index.js';

/** Base args type for owner-scoped world entity list queries. */
@ArgsType()
export class WorldConnectionArgs extends ConnectionArgs {
    @Field(() => ID)
    @IsNotEmpty()
    campaignId!: string;
}
