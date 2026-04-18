import { Collection, type Opt, OptionalProps } from '@mikro-orm/core';
import {
    Entity, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property,
} from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { SceneType } from '../session.enums.js';
import { CombatSession } from './combat-session.entity.js';
import { GameEvent } from './game-event.entity.js';

/**
 * Represents a single gameplay sitting for a campaign. At most one active session
 * (endedAt = null) may exist per campaign at any time.
 */
@ObjectType()
@Entity({ tableName: 'game_session' })
export class GameSession extends BaseEntity {
    [OptionalProps]?: 'campaignId' | 'startedAt' | 'sceneType' | 'levelUpPending';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Campaign)
    campaign!: Campaign;

    @Field(() => ID)
    get campaignId(): number {
        return this.campaign.id;
    }

    @Field(() => SceneType)
    @Property({ type: 'text', default: SceneType.EXPLORATION })
    sceneType: Opt<SceneType> = SceneType.EXPLORATION;

    @Field()
    @Property({ type: 'timestamptz', onCreate: () => new Date() })
    startedAt: Opt<Date> = new Date();

    @Field({ nullable: true })
    @Property({ type: 'timestamptz', nullable: true })
    endedAt: Date | null = null;

    /** True while a level-up is pending player confirmation. Disables standard input in the frontend. */
    @Field()
    @Property({ type: 'boolean', default: false })
    levelUpPending: Opt<boolean> = false;

    /** Active combat encounter, if any. Null when not in combat. */
    @Field(() => CombatSession, { nullable: true })
    @OneToOne(() => CombatSession, (cs) => cs.session, { nullable: true, orphanRemoval: true })
    combatSession: CombatSession | null = null;

    /** Append-only event log for the session transcript. */
    @OneToMany(() => GameEvent, (event) => event.session)
    events = new Collection<GameEvent>(this);
}
