import { type Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { SrdClass } from '../../srd/entities/srd-class.entity.js';
import { SrdRace } from '../../srd/entities/srd-race.entity.js';
import { type AbilityScores, type SkillProficiencies, type SpellSlot } from '../character.enums.js';
import { Campaign } from './campaign.entity.js';

/**
 * Represents a player character with all game state: stats, inventory, spells, and currency.
 * Created once per campaign and updated continuously as the game session progresses.
 */
@ObjectType()
@Entity()
export class Character extends BaseEntity {
    @Field(() => ID)
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Field()
    @Property({ type: 'text' })
    name!: string;

    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    level: Opt<number> = 1;

    /** Ability score values as {STR, DEX, CON, INT, WIS, CHA}. Modifiers are computed at runtime. */
    @Field(() => Object)
    @Property({ type: 'jsonb' })
    abilityScores!: AbilityScores;

    @Field(() => Int)
    @Property({ type: 'integer' })
    hp!: number;

    @Field(() => Int)
    @Property({ type: 'integer' })
    maxHp!: number;

    @Field(() => Int)
    @Property({ type: 'integer' })
    ac!: number;

    @Field(() => [String])
    @Property({ type: 'jsonb', default: [] })
    conditions: Opt<string[]> = [];

    /** Spell slots per level: [{level, total, used}]. Empty for non-spellcasting classes. */
    @Field(() => [Object])
    @Property({ type: 'jsonb', default: [] })
    spellSlots: Opt<SpellSlot[]> = [];

    @Field(() => [String])
    @Property({ type: 'jsonb', default: [] })
    preparedSpells: Opt<string[]> = [];

    @Field(() => [String])
    @Property({ type: 'jsonb', nullable: true, default: [] })
    personalityTraits: Opt<string[]> = [];

    @Field(() => [String])
    @Property({ type: 'jsonb', nullable: true, default: [] })
    ideals: Opt<string[]> = [];

    @Field(() => [String])
    @Property({ type: 'jsonb', nullable: true, default: [] })
    bonds: Opt<string[]> = [];

    @Field(() => [String])
    @Property({ type: 'jsonb', nullable: true, default: [] })
    flaws: Opt<string[]> = [];

    /** Map of all 18 skill names to proficiency level: 'none' | 'proficient' | 'expert'. */
    @Field(() => Object)
    @Property({ type: 'jsonb' })
    skillProficiencies!: SkillProficiencies;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    goldPieces: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    silverPieces: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    copperPieces: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    xp: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    deathSaveSuccesses: Opt<number> = 0;

    @Field(() => Int)
    @Property({ type: 'integer', default: 0 })
    deathSaveFailures: Opt<number> = 0;

    @Field()
    @Property({ type: 'boolean', default: false })
    isDead: Opt<boolean> = false;

    /** Hit dice remaining for short rests. Starts equal to level; partially restored on long rest. */
    @Field(() => Int)
    @Property({ type: 'integer', default: 1 })
    hitDiceRemaining: Opt<number> = 1;

    @Field(() => SrdRace)
    @ManyToOne(() => SrdRace)
    race!: SrdRace;

    @Field(() => SrdClass, { name: 'class' })
    @ManyToOne(() => SrdClass)
    srdClass!: SrdClass;

    @ManyToOne(() => Campaign)
    campaign!: Campaign;

    /** Proficiency bonus derived from level: floor((level - 1) / 4) + 2. Not stored in DB. */
    @Field(() => Int)
    get proficiencyBonus(): number {
        return Math.floor((this.level - 1) / 4) + 2;
    }
}
