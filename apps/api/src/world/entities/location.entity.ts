import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * A named place in the campaign world. Discovery is tracked via `LocationDiscovery`;
 * `Location` itself never stores a discovered flag.
 */
@ObjectType()
@Entity()
export class Location extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    /** Narrative state of the location as the world evolves. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    currentState: string | null = null;

    /** Grid or rough coordinates for map placement: { x, y }. */
    @Field(() => Object, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    coordinates: { x: number; y: number } | null = null;

    /** IDs of adjacent Location rows for travel graph traversal. */
    @Field(() => [ID], { nullable: true })
    @Property({ type: 'jsonb', default: [] })
    connectedLocationIds: Opt<number[]> = [];

    /** Recent narrative events associated with this location. */
    @Field(() => [String], { nullable: true })
    @Property({ type: 'jsonb', default: [] })
    recentEvents: Opt<string[]> = [];
}
