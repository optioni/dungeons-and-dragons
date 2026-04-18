import { type Opt } from '@mikro-orm/core';
import {
    Entity, OneToOne, PrimaryKey, Property,
} from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { GameSession } from './game-session.entity.js';

export interface Combatant {
    id: string;
    type: 'CHARACTER' | 'NPC';
    name: string;
    initiativeRoll: number;
    currentHp: number;
    maxHp: number;
    conditions: string[];
    usedAction: boolean;
    usedBonusAction: boolean;
    usedReaction: boolean;
    /** Feet of movement used this turn. */
    movementUsed: number;
    /** True if this NPC had a non-null hp before combat started (named NPC). */
    namedNpc?: boolean;
}

/**
 * Persists the in-flight state of an active combat encounter for a GameSession.
 * Created by `start_combat`, deleted by `end_combat`.
 */
@ObjectType()
@Entity({ tableName: 'combat_session' })
export class CombatSession extends BaseEntity {
    [Symbol.for('mikro-orm:optional-props')]?: 'currentTurnIndex' | 'roundNumber';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @OneToOne(() => GameSession, { fieldName: 'session_id' })
    session!: GameSession;

    /** Ordered by initiative descending. HP for NPCs is authoritative here; character HP is in Character entity. */
    @Field(() => [Object])
    @Property({ type: 'jsonb' })
    combatants!: Combatant[];

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    currentTurnIndex: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    roundNumber: Opt<number> = 1;
}
