import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { VectorType } from '../types/vector.type.js';

export enum SubjectType {
    NPC = 'npc',
    CHARACTER = 'character',
    LOCATION = 'location',
    FACTION = 'faction',
    ITEM = 'item',
    GENERAL = 'general',
}

/**
 * A discrete established fact about an entity in the campaign world.
 * Created by the `record_memory` LLM tool; retrieved via `search_memories`.
 */
@Entity({ tableName: 'memory' })
export class Memory extends BaseEntity {
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Campaign, { deleteRule: 'cascade' })
    campaign!: Campaign;

    get campaignId(): number {
        return this.campaign.id;
    }

    @Property({ type: 'text' })
    subjectType!: SubjectType;

    @Property({ type: 'uuid', nullable: true })
    subjectId: string | null = null;

    @Property({ columnType: 'varchar(1000)' })
    content!: string;

    @Property({ type: VectorType, nullable: true })
    embedding: number[] | null = null;

    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
