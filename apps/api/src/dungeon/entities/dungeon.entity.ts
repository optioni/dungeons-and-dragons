import {
    Collection, type Opt, OptionalProps,
} from '@mikro-orm/core';
import {
    Entity, ManyToOne, OneToMany, PrimaryKey, Property,
} from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { Campaign } from '../../campaign/entities/campaign.entity.js';
import { JsonScalar } from '../../graphql/scalars/json.scalar.js';
import { Location } from '../../world/entities/location.entity.js';

export interface EncounterTableEntry {
    weight: number
    monsters: MonsterSpec[]
}

export interface MonsterSpec {
    srdIndex?: string
    name: string
    count: number
    hp?: number
}

/**
 * A dungeon is a campaign-scoped structure containing room Locations, keyed encounters,
 * and an optional wandering encounter table.
 */
@ObjectType()
@Entity({ tableName: 'dungeon' })
export class Dungeon extends BaseEntity {
    [OptionalProps]?: 'campaignId' | 'totalFloors' | 'encounterTable';

    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @ManyToOne(() => Campaign)
    campaign!: Campaign;

    @Field(() => ID)
    get campaignId(): number {
        return this.campaign.id;
    }

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field()
    @Property({ type: 'text' })
    description!: string;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    totalFloors: Opt<number> = 1;

    @Field(() => JsonScalar, { nullable: true })
    @Property({ type: 'jsonb', nullable: true })
    encounterTable: EncounterTableEntry[] | null = null;

    @OneToMany(() => Location, (location) => location.dungeon)
    rooms = new Collection<Location>(this);
}
