import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** Join table placing a Location on a specific Map with optional positional metadata. */
@ObjectType()
@Entity()
export class MapLocation extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    mapId!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    locationId!: number;
}
