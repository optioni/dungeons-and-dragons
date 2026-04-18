import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * A named map belonging to a campaign, grouping locations by scale
 * (e.g. world map, region map, dungeon level).
 */
@ObjectType()
@Entity()
export class Map extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    description: string | null = null;

    /** Narrative description of the map's extent — e.g. "1 square = 5 miles". */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    scale: string | null = null;
}
