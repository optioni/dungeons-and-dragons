import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { VectorType } from '../types/vector.type.js';

/**
 * Haiku-written narrative summary for one in-game day. Created by
 * `MemoryService.writeDiaryEntry()` on each `take_long_rest` call.
 */
@Entity({ tableName: 'diary_entry' })
export class DiaryEntry extends BaseEntity {
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Campaign, { deleteRule: 'cascade' })
    campaign!: Campaign;

    get campaignId(): number {
        return this.campaign.id;
    }

    @Property({ type: 'text' })
    inGameDate!: string;

    @Property({ columnType: 'varchar(1000)' })
    content!: string;

    @Property({ type: VectorType, nullable: true })
    embedding: number[] | null = null;

    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
