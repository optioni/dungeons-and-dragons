import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

@ObjectType()
@Entity()
export class SrdRace extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field()
    @Property({ type: 'text', unique: true })
    index!: string;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field(() => Int)
    @Property({ type: 'integer' })
    speed!: number;

    @Field(() => GraphQLJSON)
    @Property({ type: 'jsonb' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    abilityBonuses!: Array<{ ability_score: { name: string }; bonus: number }>;

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    traits!: string[];

    @Field()
    @Property({ type: 'text' })
    size!: string;
}
