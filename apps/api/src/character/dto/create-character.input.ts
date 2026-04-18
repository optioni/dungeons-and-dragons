import { Field, ID, InputType, Int } from '@nestjs/graphql';

/**
 * The six D&D 5e ability scores provided during character creation.
 * Values must be a permutation of the standard array [15, 14, 13, 12, 10, 8].
 */
/* eslint-disable @typescript-eslint/naming-convention */
@InputType()
export class AbilityScoresInput {
    @Field(() => Int)
    STR!: number;

    @Field(() => Int)
    DEX!: number;

    @Field(() => Int)
    CON!: number;

    @Field(() => Int)
    INT!: number;

    @Field(() => Int)
    WIS!: number;

    @Field(() => Int)
    CHA!: number;
}
/* eslint-enable @typescript-eslint/naming-convention */

/** Input for the `createCharacter` mutation. Ties a name, SRD race/class, campaign, and ability scores together. */
@InputType()
export class CreateCharacterInput {
    @Field()
    name!: string;

    /** ID of the SrdRace to assign. */
    @Field(() => ID)
    raceId!: number;

    /** ID of the SrdClass to assign. */
    @Field(() => ID)
    classId!: number;

    /** ID of the campaign this character belongs to. */
    @Field(() => ID)
    campaignId!: number;

    @Field(() => AbilityScoresInput)
    abilityScores!: AbilityScoresInput;
}
