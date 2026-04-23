import { type Opt, OptionalProps } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, ID, ObjectType,
} from '@nestjs/graphql';

import { JsonScalar } from '../../graphql/scalars/json.scalar.js';
import { Location } from '../../world/entities/location.entity.js';
import { type MonsterSpec } from './dungeon.entity.js';

/**
 * A keyed encounter stocked into a specific dungeon room.
 */
@ObjectType()
@Entity({ tableName: 'room_encounter' })
export class RoomEncounter extends BaseEntity {
    [OptionalProps]?: 'roomId' | 'cleared';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Location)
    room!: Location;

    @Field(() => ID)
    get roomId(): number {
        return this.room.id;
    }

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field()
    @Property({ type: 'boolean', default: false })
    cleared: Opt<boolean> = false;

    @Field(() => JsonScalar)
    @Property({ type: 'jsonb' })
    monsters!: MonsterSpec[];
}
