import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { NpcPartyStatus } from '../world.enums.js';

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

    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    description: string | null = null;

    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    profession: string | null = null;

    /** Primary drive that motivates all of the NPC's decisions. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    coreMotivation: string | null = null;

    /** Concise adjectives or phrases describing how this NPC behaves. */
    @Field(() => [String], { nullable: true })
    @Property({ type: 'jsonb', default: [] })
    personalityTraits: Opt<string[]> = [];

    /** Distinctive voice or verbal tics used to portray this NPC in dialogue. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    speechStyle: string | null = null;

    /** General stance toward the player (friendly, neutral, hostile, etc.). */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    disposition: string | null = null;

    /** FK to Location where the NPC is currently located. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    currentLocationId: number | null = null;

    @Field()
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
     * Haiku calls when `nextTickInGameDate` is reached.
     */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    agenda: string | null = null;

    /**
     * In-game date when this NPC's agenda should next be evaluated.
     * A narrative string, not a real timestamp.
     */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    nextTickInGameDate: string | null = null;
}
