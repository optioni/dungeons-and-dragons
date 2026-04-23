import { type Opt, OptionalProps } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, ID, Int, ObjectType,
} from '@nestjs/graphql';

import { Item } from '../../character/entities/item.entity.js';
import { Location } from '../../world/entities/location.entity.js';

/**
 * A pre-placed item stack in a dungeon room.
 */
@ObjectType()
@Entity({ tableName: 'room_item' })
export class RoomItem extends BaseEntity {
    [OptionalProps]?: 'roomId' | 'itemId' | 'quantity' | 'containerName';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Location)
    room!: Location;

    @Field(() => ID)
    get roomId(): number {
        return this.room.id;
    }

    @ManyToOne(() => Item)
    item!: Item;

    @Field(() => ID)
    get itemId(): number {
        return this.item.id;
    }

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    quantity: Opt<number> = 1;

    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    containerName: string | null = null;
}
