import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Entity()
export class SrdSpell extends BaseEntity {
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
    level!: number;

    @Field()
    @Property({ type: 'text' })
    school!: string;

    @Field()
    @Property({ type: 'text' })
    castingTime!: string;

    @Field()
    @Property({ type: 'text' })
    range!: string;

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    components!: string[];

    @Field()
    @Property({ type: 'text' })
    duration!: string;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    higherLevel: string | null = null;

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    classes!: string[];
}
