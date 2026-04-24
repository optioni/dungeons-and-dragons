import { ArgsType, Field } from '@nestjs/graphql';

import { WorldEventStatus } from '../world.enums.js';
import { WorldConnectionArgs } from './world-connection.args.js';

/** Args for the worldEvents relay connection query; adds optional status filter. */
@ArgsType()
export class WorldEventsConnectionArgs extends WorldConnectionArgs {
    @Field(() => WorldEventStatus, { nullable: true })
    status?: WorldEventStatus;
}
