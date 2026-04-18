import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

@InputType()
export class GenerateWorldSeedInput {
    @Field(() => ID)
    @IsNotEmpty()
    campaignId!: string;
}
