import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { QuestEntityType } from '../quest.enums.js';
import { Quest } from './quest.entity.js';

/**
 * Polymorphic join table linking a quest to world entities.
 * No FK constraint on entityId — application-level reference only.
 */
@ObjectType()
@Entity({ tableName: 'quest_entity' })
export class QuestEntity extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer', fieldName: 'quest_id' })
    questId!: number;

    @ManyToOne(() => Quest, { fieldName: 'quest_id' })
    quest!: Quest;

    @Field(() => QuestEntityType)
    @Property({ type: 'text' })
    entityType!: QuestEntityType;

    @Field(() => Int)
    @Property({ type: 'integer' })
    entityId!: number;
}
