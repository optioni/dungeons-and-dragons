import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

import { NpcRelationshipType } from '../world.enums.js';

/**
 * Directional relationship between two NPCs in the same campaign.
 * Both endpoints must belong to the same campaign.
 */
@ObjectType()
@Entity()
export class NpcRelationship extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    sourceNpcId!: number;

    @Field(() => ID)
    @Property({ type: 'integer' })
    targetNpcId!: number;

    @Field(() => NpcRelationshipType)
    @Property({ type: 'text' })
    type!: NpcRelationshipType;

    /** Narrative description of the relationship's history. */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    description: string | null = null;

    /** How the source NPC currently feels toward the target (warm, wary, bitter, etc.). */
    @Field({ nullable: true })
    @Property({ type: 'text', nullable: true })
    disposition: string | null = null;
}
