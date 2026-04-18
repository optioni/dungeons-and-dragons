import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

@InputType()
export class SelectConceptInput {
    @Field(() => ID)
    @IsNotEmpty()
    campaignId!: string;

    /** Zero-based index into the campaign's generatedConcepts array. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    conceptIndex!: number;
}
