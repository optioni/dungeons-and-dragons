import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import {
    Field, ID, ObjectType, registerEnumType,
} from '@nestjs/graphql';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { VectorType } from '../types/vector.type.js';

export enum DiaryEntryType {
    DAILY = 'DAILY',
    MEMORIAL = 'MEMORIAL',
}

registerEnumType(DiaryEntryType, { name: 'DiaryEntryType' });

/**
 * Haiku-written narrative summary for one in-game day. Created by
 * `MemoryService.writeDiaryEntry()` on each `take_long_rest` call.
 */
@ObjectType()
@Entity({ tableName: 'diary_entry' })
export class DiaryEntry extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Campaign, { deleteRule: 'cascade' })
    campaign!: Campaign;

    @Field(() => ID)
    get campaignId(): number {
        return this.campaign.id;
    }

    @Field(() => DiaryEntryType)
    @Property({ type: 'text', default: DiaryEntryType.DAILY })
    entryType: Opt<DiaryEntryType> = DiaryEntryType.DAILY;

    @Field()
    @Property({ type: 'text' })
    inGameDate!: string;

    @Field()
    @Property({ type: 'text', columnType: 'varchar(1000)' })
    content!: string;

    /** Embedding vector — internal only, never exposed via GraphQL. */
    @Property({ type: VectorType, nullable: true })
    embedding: number[] | null = null;

    @Field(() => Date)
    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
