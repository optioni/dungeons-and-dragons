import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

import { WorldEventSource, WorldEventStatus } from '../world.enums.js';

/**
 * A diegetic world pressure — an event, threat, or opportunity that exists
 * independently of the player and may resolve or escalate over time.
 */
@ObjectType()
@Entity()
export class WorldEvent extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    /** Location where this event is centred, if applicable. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    locationId: number | null = null;

    /** In-game date after which the event escalates or expires if unresolved. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    deadlineInGameDate: string | null = null;

    @Field(() => WorldEventSource)
    @Property({ type: 'text', default: WorldEventSource.WORLD_TICK })
    source: Opt<WorldEventSource> = WorldEventSource.WORLD_TICK;

    @Field(() => WorldEventStatus)
    @Property({ type: 'text', default: WorldEventStatus.ACTIVE })
    status: Opt<WorldEventStatus> = WorldEventStatus.ACTIVE;

    /** Narrative summary of how the event concluded. Set when status → RESOLVED. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    outcome: string | null = null;

    @Field()
    @Property({ type: 'date', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
