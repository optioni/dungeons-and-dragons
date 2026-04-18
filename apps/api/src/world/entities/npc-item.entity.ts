import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * An item carried or sold by an NPC. `merchantPrice` is set for merchants;
 * null means the item is not for sale.
 */
@ObjectType()
@Entity()
export class NpcItem extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    npcId!: number;

    /** Optional FK to an Item entity (set when the item was stocked via restock_merchant). */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    itemId: number | null = null;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    quantity: Opt<number> = 1;

    /** Price in gold pieces. Non-null indicates the NPC will sell this item. */
    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    merchantPrice: number | null = null;
}
