import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { QuestObjectiveStatus, QuestObjectiveType } from '../quest.enums.js';
import { Quest } from './quest.entity.js';

/** A single measurable goal within a quest. Status defaults to INCOMPLETE. */
@ObjectType()
@Entity({ tableName: 'quest_objective' })
export class QuestObjective extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer', fieldName: 'quest_id' })
    questId!: number;

    @ManyToOne(() => Quest, { fieldName: 'quest_id' })
    quest!: Quest;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field(() => QuestObjectiveType)
    @Property({ type: 'text' })
    type!: QuestObjectiveType;

    @Field(() => QuestObjectiveStatus)
    @Property({ type: 'text', default: QuestObjectiveStatus.INCOMPLETE })
    status: Opt<QuestObjectiveStatus> = QuestObjectiveStatus.INCOMPLETE;

    /** References the world entity this objective tracks. Null for MANUAL/TALK_TO_NPC types. */
    @Field(() => ID, { nullable: true })
    @Property({ type: 'integer', nullable: true })
    entityId: number | null = null;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    order: Opt<number> = 0;
}
