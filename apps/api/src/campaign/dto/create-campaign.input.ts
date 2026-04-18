import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreateCampaignInput {
    @Field()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;
}
