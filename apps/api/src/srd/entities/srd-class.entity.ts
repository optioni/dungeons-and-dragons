import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Entity()
export class SrdClass extends BaseEntity {
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
    hitDie!: number;

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    proficiencies!: string[];

    @Field(() => [String])
    @Property({ type: 'jsonb' })
    savingThrows!: string[];

    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    spellcastingAbility: string | null = null;
}
