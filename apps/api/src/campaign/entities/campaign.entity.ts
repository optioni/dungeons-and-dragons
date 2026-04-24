import { Collection, type Opt } from '@mikro-orm/core';
import { Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

import { DiaryEntry } from '../../memory/entities/diary-entry.entity.js';
import { Memory } from '../../memory/entities/memory.entity.js';
import {
    type AntagonistPlanState,
    CampaignSetupStatus,
    CampaignStatus,
    CampaignTone,
    DeathMode,
    type OpeningSceneSeed,
    type StoryConcept,
} from '../campaign.enums.js';

/**
 * Represents a D&D campaign. Owned by one user; progresses through a setup state
 * machine before becoming ready to play. Stores all setup outputs needed to resume
 * the wizard after a refresh or mutation failure.
 */
@ObjectType()
@Entity({ tableName: 'campaign' })
export class Campaign extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    /** Internal FK — not exposed via GraphQL to avoid leaking user IDs. */
    @Property({ type: 'integer' })
    userId!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    /** Campaign lifecycle state — permanently transitions to ENDED on campaign conclusion. */
    @Field(() => CampaignStatus)
    @Property({ type: 'text', default: CampaignStatus.ACTIVE })
    status: Opt<CampaignStatus> = CampaignStatus.ACTIVE;

    /** Timestamp when the campaign was ended. Null for active campaigns. */
    @Field(() => Date, { nullable: true })
    @Property({ type: 'timestamptz', nullable: true })
    endedAt: Date | null = null;

    /** Short description of why/how the campaign ended. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    endReason: string | null = null;

    /** Drives the setup wizard step logic. Only advances on successful mutation completion. */
    @Field(() => CampaignSetupStatus)
    @Property({ type: 'text', default: CampaignSetupStatus.DRAFT })
    setupStatus: Opt<CampaignSetupStatus> = CampaignSetupStatus.DRAFT;

    /** Set when the player chooses a tone during generateCampaignStoryConcepts. */
    @Field(() => CampaignTone, { nullable: true })
    @Property({ type: 'text', nullable: true })
    tone: CampaignTone | null = null;

    /** Set alongside tone. */
    @Field(() => DeathMode, { nullable: true })
    @Property({ type: 'text', nullable: true })
    deathMode: DeathMode | null = null;

    /** 3-4 story concepts persisted after the LLM generation step. */
    @Field(() => GraphQLJSON, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    generatedConcepts: StoryConcept[] | null = null;

    /** The player's chosen concept; becomes the seed for world generation. */
    @Field(() => GraphQLJSON, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    selectedConcept: StoryConcept | null = null;

    /**
     * Bootstrap narrative seed stored during world generation.
     * Materialized into the first GameEvent when SessionModule creates the initial session.
     */
    @Field(() => GraphQLJSON, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    openingSceneSeed: OpeningSceneSeed | null = null;

    /** FK to the Npc entity that is the main antagonist. Set after world seed. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    antagonistNpcId: number | null = null;

    /** Structured antagonist plan state read by tool calls during play. */
    @Field(() => GraphQLJSON, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    antagonistPlanState: AntagonistPlanState | null = null;

    /** FK to the Location entity for the player's current position. Set after world seed. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    currentLocationId: number | null = null;

    /** In-game calendar date expressed as a narrative string (e.g. "Day 1, Month of Frost"). */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    inGameDate: string | null = null;

    /** Monotonic day counter — authoritative source of truth for all time-relative comparisons. Incremented by `take_long_rest`. */
    @Property({ type: 'integer', default: 1 })
    inGameDay: Opt<number> = 1;

    /** When false, travel_to skips the random encounter roll entirely. */
    @Field(() => Boolean)
    @Property({ type: 'boolean', default: true })
    travelEncounterEnabled: Opt<boolean> = true;

    /** Narrative facts about the world — not canonical state read by tool calls. */
    @Field(() => String, { nullable: true })
    @Property({ type: 'text', nullable: true })
    loreDocument: string | null = null;

    @Field(() => Date)
    @Property({ type: 'date', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();

    @OneToMany(() => DiaryEntry, (diaryEntry) => diaryEntry.campaign)
    diaryEntries = new Collection<DiaryEntry>(this);

    @OneToMany(() => Memory, (memory) => memory.campaign)
    memories = new Collection<Memory>(this);
}
