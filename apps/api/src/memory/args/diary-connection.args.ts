import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

import { ConnectionArgs } from '../../graphql/relay';

/** Args for the owner-scoped diary entries relay connection query. */
@ArgsType()
export class DiaryConnectionArgs extends ConnectionArgs {
    @Field(() => ID)
    @IsNotEmpty()
    campaignId!: string;
}
