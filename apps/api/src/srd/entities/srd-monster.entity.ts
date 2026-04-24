import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, Float, ID, Int, ObjectType,
} from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

@ObjectType()
@Entity()
export class SrdMonster extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field()
    @Property({ type: 'text', unique: true })
    index!: string;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field()
    @Property({ type: 'text' })
    size!: string;

    @Field()
    @Property({ type: 'text' })
    type!: string;

    @Field()
    @Property({ type: 'text' })
    alignment!: string;

    @Field(() => Int)
    @Property({ type: 'integer' })
    armorClass!: number;

    @Field(() => Int)
    @Property({ type: 'integer' })
    hitPoints!: number;

    @Field(() => Float)
    @Property({ type: 'float' })
    challengeRating!: number;

    @Field(() => GraphQLJSON)
    @Property({ type: 'jsonb' })
    speed!: Record<string, string>;

    @Field(() => GraphQLJSON)
    @Property({ type: 'jsonb' })
    abilityScores!: Record<string, number>;

    @Field(() => GraphQLJSON)
    @Property({ type: 'jsonb' })
    actions!: Array<Record<string, unknown>>;
}
