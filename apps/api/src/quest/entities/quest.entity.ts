import { type Opt } from '@mikro-orm/core';
import { Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity, Collection } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { QuestStatus } from '../quest.enums.js';
import { QuestEntity } from './quest-entity.entity.js';
import { QuestObjective } from './quest-objective.entity.js';

/**
 * A campaign-scoped quest with objectives and linked world entities.
 * Status transitions from ACTIVE to COMPLETED or FAILED via explicit tool calls.
 */
@ObjectType()
@Entity({ tableName: 'quest' })
export class Quest extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer', fieldName: 'campaign_id' })
    campaignId!: number;

    @Field()
    @Property({ type: 'text' })
    title!: string;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field(() => QuestStatus)
    @Property({ type: 'text', default: QuestStatus.ACTIVE })
    status: Opt<QuestStatus> = QuestStatus.ACTIVE;

    /** Instructions for how NPC agendas shift when this quest resolves. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    agendaImpact: string | null = null;

    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    rewardNarrative: string | null = null;

    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    rewardXp: number | null = null;

    @Field(() => Int, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    rewardGold: number | null = null;

    @Field()
    @Property({ type: 'datetime', defaultRaw: 'now()' })
    createdAt: Opt<Date> = new Date();

    @Field(() => [QuestObjective])
    @OneToMany(() => QuestObjective, (objective) => objective.quest, { orderBy: { order: 'ASC' } })
    objectives = new Collection<QuestObjective>(this);

    @Field(() => [QuestEntity])
    @OneToMany(() => QuestEntity, (entity) => entity.quest)
    entities = new Collection<QuestEntity>(this);
}
