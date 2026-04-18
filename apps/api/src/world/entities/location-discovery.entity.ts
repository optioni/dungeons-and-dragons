import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

import { LocationDiscoverySource } from '../world.enums.js';

/**
 * Records when a campaign discovered a location.
 * A location is considered discovered if and only if a row exists here —
 * `Location` itself never stores a `discovered` flag.
 */
@ObjectType()
@Entity()
export class LocationDiscovery extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    locationId!: number;

    @Field()
    @Property({ type: 'date', onCreate: () => new Date() })
    discoveredAt: Opt<Date> = new Date();

    @Field(() => LocationDiscoverySource)
    @Property({ type: 'text', default: LocationDiscoverySource.PLAYER_ACTION })
    source: Opt<LocationDiscoverySource> = LocationDiscoverySource.PLAYER_ACTION;

    /** Optional ID of the entity that triggered discovery (e.g. WorldEvent id). */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    sourceId: number | null = null;
}
