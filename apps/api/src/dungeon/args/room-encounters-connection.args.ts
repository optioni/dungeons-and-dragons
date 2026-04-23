import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

import { ConnectionArgs } from '../../graphql/relay';

@ArgsType()
export class RoomEncountersConnectionArgs extends ConnectionArgs {
    @Field(() => ID)
    @IsNotEmpty()
    dungeonId!: string;
}
