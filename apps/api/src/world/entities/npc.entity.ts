import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { NpcPartyStatus } from '../world.enums.js';
import { NpcRelationship } from './npc-relationship.entity.js';

/**
 * A non-player character in the campaign world. Antagonists are stored here as normal
 * NPCs; the Campaign entity holds an `antagonistNpcId` pointer.
 */
@ObjectType()
@Entity()
export class Npc extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    description: string | null = null;

    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    profession: string | null = null;

    /** Primary drive that motivates all of the NPC's decisions. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    coreMotivation: string | null = null;

    /** Concise adjectives or phrases describing how this NPC behaves. */
    @Field(() => [String], { nullable: true })
    @Property({ type: 'jsonb', default: [] })
    personalityTraits: Opt<string[]> = [];

    /** Distinctive voice or verbal tics used to portray this NPC in dialogue. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    speechStyle: string | null = null;

    /** General stance toward the player (friendly, neutral, hostile, etc.). */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    disposition: string | null = null;

    /** FK to Location where the NPC is currently located. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    currentLocationId: number | null = null;

    @Field(() => Boolean)
    @Property({ type: 'boolean', default: true })
    alive: Opt<boolean> = true;

    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    hp: number | null = null;

    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    maxHp: number | null = null;

    @Field(() => NpcPartyStatus)
    @Property({ type: 'text', default: NpcPartyStatus.NONE })
    partyStatus: Opt<NpcPartyStatus> = NpcPartyStatus.NONE;

    /**
     * What the NPC is currently trying to achieve. Processed by the world-tick
     * Haiku calls when `nextTickInGameDay` is reached.
     */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    agenda: string | null = null;

    /**
     * In-game day when this NPC's agenda should next be evaluated.
     * An integer compared against `campaign.inGameDay`. Null means no scheduled tick.
     */
    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    nextTickInGameDay: number | null = null;

    /** Timestamp of the last world-tick conversation this NPC participated in. */
    @Field(() => Date, { nullable: true })
    @Property({ type: 'datetime', nullable: true })
    lastConversedAt: Date | null = null;

    /**
     * Relationships where this NPC is the source. Populated on demand by the
     * `npc(id)` resolver; not persisted as a MikroORM collection.
     */
    @Field(() => [NpcRelationship], { nullable: true })
    relationships?: NpcRelationship[];
}
