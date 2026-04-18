import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, ID, Int, ObjectType,
} from '@nestjs/graphql';

import { EquipSlot } from '../character.enums.js';
import { Character } from './character.entity.js';
import { Item } from './item.entity.js';

/**
 * Join entity linking a Character to an Item they carry or have equipped.
 * The `slot` field is null when the item is carried but not equipped.
 */
@ObjectType()
@Entity()
export class CharacterItem extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    /** Back-reference to the owning character. Not exposed via GraphQL. */
    @ManyToOne(() => Character)
    character!: Character;

    @Field(() => Item)
    @ManyToOne(() => Item)
    item!: Item;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    quantity: Opt<number> = 1;

    /** Null means the item is carried but not equipped. */
    @Field(() => EquipSlot, { nullable: true })
    @Property({ type: 'text', nullable: true })
    slot: EquipSlot | null = null;

    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    condition: string | null = null;
}
