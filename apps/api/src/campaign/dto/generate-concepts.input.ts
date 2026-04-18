import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { CampaignTone, DeathMode } from '../campaign.enums.js';

@InputType()
export class GenerateConceptsInput {
    @Field(() => ID)
    @IsNotEmpty()
    campaignId!: string;

    @Field(() => CampaignTone)
    @IsEnum(CampaignTone)
    tone!: CampaignTone;

    @Field(() => DeathMode)
    @IsEnum(DeathMode)
    deathMode!: DeathMode;
}
