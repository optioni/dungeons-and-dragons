import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, Float, ID, Int, ObjectType,
} from '@nestjs/graphql';

import { SrdEquipment } from '../../srd/entities/srd-equipment.entity.js';
import { ItemType } from '../character.enums.js';

/**
 * A game item that can be held in a character's inventory.
 * Optionally linked to an `SrdEquipment` record when it has stat-bearing SRD data.
 */
@ObjectType()
@Entity()
export class Item extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field(() => Float, { nullable: true })
    @Property({ type: 'float', nullable: true })
    weight: number | null = null;

    /** Value in copper pieces. */
    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    value: number | null = null;

    @Field(() => ItemType)
    @Property({ type: 'text' })
    itemType!: ItemType;

    @Field(() => SrdEquipment, { nullable: true })
    @ManyToOne(() => SrdEquipment, { nullable: true })
    srdEquipment: SrdEquipment | null = null;
}
