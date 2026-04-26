import { ArgsType, Field, ID } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay';

@ArgsType()
export class GameEventsConnectionArgs extends ConnectionArgs {
    @Field(() => ID)
    readonly sessionId!: string;
}
