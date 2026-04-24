import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * A political or social group in the campaign world with goals,
 * power, and a disposition toward the player.
 */
@ObjectType()
@Entity()
export class Faction extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    /** What the faction is trying to achieve. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    goals: string | null = null;

    /** 1-10 scale: relative military/political strength. */
    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    powerLevel: number | null = null;

    /** Current attitude toward the player: friendly, neutral, hostile, etc. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    playerDisposition: string | null = null;

    /** Geographic or social domain this faction controls. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    territory: string | null = null;
}
