import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

@ObjectType()
@Entity()
export class SrdEquipment extends BaseEntity {
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
    category!: string;

    @Field(() => GraphQLJSON)
    @Property({ type: 'jsonb' })
    cost!: { quantity: number; unit: string };

    @Field(() => Float, { nullable: true })
    @Property({ type: 'float', nullable: true })
    weight: number | null = null;

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    properties!: string[];

    @Field(() => GraphQLJSON, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    damage: Record<string, unknown> | null = null;
}
