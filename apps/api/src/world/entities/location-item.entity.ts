import { type Opt, OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, ID, Int, ObjectType,
} from '@nestjs/graphql';

/**
 * An item stack present at an overworld location (not a dungeon room).
 * Distinct from `RoomItem` which is dungeon-only and requires an active dungeon session.
 */
@ObjectType()
@Unique({ properties: ['locationId', 'itemId'] })
@Entity({ tableName: 'location_item' })
export class LocationItem extends BaseEntity {
    [OptionalProps]?: 'quantity';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    locationId!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    itemId!: number;

    /** Cached item name to avoid joins in context loading. */
    @Field()
    @Property({ type: 'text' })
    itemName!: string;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    quantity: Opt<number> = 1;

    /** Short description of how the item came to be here (e.g., "left by the archivist"). */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    note: string | null = null;
}
