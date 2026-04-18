import { type Opt, OptionalProps } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

import { JsonScalar } from '../../graphql/scalars/json.scalar.js';
import { EventType } from '../session.enums.js';
import { GameSession } from './game-session.entity.js';

/**
 * Append-only transcript entry for a GameSession. Content is typed jsonb to
 * support extensible payload shapes per event type without schema churn.
 * No update path — only insert and read.
 */
@ObjectType()
@Entity({ tableName: 'game_event' })
export class GameEvent extends BaseEntity {
    [OptionalProps]?: 'sessionId' | 'createdAt';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => GameSession)
    session!: GameSession;

    @Field(() => ID)
    get sessionId(): number {
        return this.session.id;
    }

    @Field(() => EventType)
    @Property({ type: 'text' })
    eventType!: EventType;

    @Field(() => JsonScalar)
    @Property({ type: 'jsonb' })
    content!: unknown;

    @Field()
    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
