import { type Opt } from '@mikro-orm/core';
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';

import { VectorType } from '../../memory/types/vector.type.js';

/**
 * A per-NPC episodic memory: something an NPC directly experienced or was told.
 */
@Entity({ tableName: 'npc_memory' })
@Index({ properties: ['npcId'] })
export class NpcMemory extends BaseEntity {
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Property({ type: 'integer' })
    npcId!: number;

    @Property({ type: 'text', columnType: 'varchar(1000)' })
    content!: string;

    @Property({ type: VectorType, nullable: true })
    embedding: number[] | null = null;

    @Property({ type: 'text', nullable: true })
    inGameDate: string | null = null;

    @Property({ type: 'integer', nullable: true })
    sourceNpcId: number | null = null;

    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
