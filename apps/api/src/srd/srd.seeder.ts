import type { EntityManager } from '@mikro-orm/core';

import { SrdClass } from './entities/srd-class.entity.js';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdEquipment } from './entities/srd-equipment.entity.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdRace } from './entities/srd-race.entity.js';
import { SrdSpell } from './entities/srd-spell.entity.js';

const API_BASE = 'https://www.dnd5eapi.co/api';
const CONCURRENCY_LIMIT = 10;

export interface SrdLogger {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

interface ApiListItem {
    index: string;
}

interface ApiListResponse {
    count: number;
    results: ApiListItem[];
}

export interface ClassApiResponse {
    index: string;
    name: string;
    hit_die: number;
    proficiencies: Array<{ name: string }>;
    saving_throws: Array<{ name: string }>;
    spellcasting?: { spellcasting_ability: { name: string } };
}

export interface RaceApiResponse {
    index: string;
    name: string;
    speed: number;
    ability_bonuses: Array<{ ability_score: { name: string }; bonus: number }>;
    traits: Array<{ name: string }>;
    size: string;
}

export interface SpellApiResponse {
    index: string;
    name: string;
    level: number;
    school: { name: string };
    casting_time: string;
    range: string;
    components: string[];
    duration: string;
    desc: string[];
    higher_level?: string[];
    classes: Array<{ name: string }>;
}

export interface MonsterApiResponse {
    index: string;
    name: string;
    size: string;
    type: string;
    alignment: string;
    armor_class: Array<{ value: number }>;
    hit_points: number;
    challenge_rating: number;
    speed: Record<string, string>;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    actions?: Array<Record<string, unknown>>;
}

export interface EquipmentApiResponse {
    index: string;
    name: string;
    equipment_category: { name: string };
    cost: { quantity: number; unit: string };
    weight?: number;
    properties?: Array<{ name: string }>;
    damage?: Record<string, unknown>;
}

export interface ConditionApiResponse {
    index: string;
    name: string;
    desc: string[];
}

export function mapClass(raw: ClassApiResponse): Partial<SrdClass> {
    return {
        index: raw.index,
        name: raw.name,
        hitDie: raw.hit_die,
        proficiencies: raw.proficiencies.map((p) => p.name),
        savingThrows: raw.saving_throws.map((s) => s.name),
        spellcastingAbility: raw.spellcasting?.spellcasting_ability?.name ?? null,
    };
}

export function mapRace(raw: RaceApiResponse): Partial<SrdRace> {
    return {
        index: raw.index,
        name: raw.name,
        speed: raw.speed,
        abilityBonuses: raw.ability_bonuses,
        traits: raw.traits.map((t) => t.name),
        size: raw.size,
    };
}

export function mapSpell(raw: SpellApiResponse): Partial<SrdSpell> {
    return {
        index: raw.index,
        name: raw.name,
        level: raw.level,
        school: raw.school.name,
        castingTime: raw.casting_time,
        range: raw.range,
        components: raw.components,
        duration: raw.duration,
        description: raw.desc.join('\n'),
        higherLevel: raw.higher_level?.join('\n') ?? null,
        classes: raw.classes.map((c) => c.name),
    };
}

export function mapMonster(raw: MonsterApiResponse): Partial<SrdMonster> {
    return {
        index: raw.index,
        name: raw.name,
        size: raw.size,
        type: raw.type,
        alignment: raw.alignment,
        armorClass: raw.armor_class[0]?.value ?? 0,
        hitPoints: raw.hit_points,
        challengeRating: raw.challenge_rating,
        speed: raw.speed,
        abilityScores: {
            STR: raw.strength,
            DEX: raw.dexterity,
            CON: raw.constitution,
            INT: raw.intelligence,
            WIS: raw.wisdom,
            CHA: raw.charisma,
        },
        actions: raw.actions ?? [],
    };
}

export function mapEquipment(raw: EquipmentApiResponse): Partial<SrdEquipment> {
    return {
        index: raw.index,
        name: raw.name,
        category: raw.equipment_category.name,
        cost: raw.cost,
        weight: raw.weight ?? null,
        properties: raw.properties?.map((p) => p.name) ?? [],
        damage: raw.damage ?? null,
    };
}

export function mapCondition(raw: ConditionApiResponse): Partial<SrdCondition> {
    return {
        index: raw.index,
        name: raw.name,
        description: raw.desc.join('\n'),
    };
}

async function fetchBatch<T>(urls: string[], limit: number, logger: SrdLogger): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < urls.length; i += limit) {
        const batch = urls.slice(i, i + limit);
        const settled = await Promise.allSettled(
            batch.map(async (url) => {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status.toString()} fetching ${url}`);
                return res.json() as Promise<T>;
            }),
        );
        for (const result of settled) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
                logger.warn(`Skipping entry — ${message}`);
            }
        }
    }
    return results;
}

async function seedEntityType<TEntity extends object, TApiResponse>(
    em: EntityManager,
    logger: SrdLogger,
    entityClass: new () => TEntity,
    resourcePath: string,
    mapFn: (raw: TApiResponse) => Partial<TEntity>,
): Promise<void> {
    const label = entityClass.name;

    const count = await em.count(entityClass);
    if (count > 0) {
        logger.log(`${label}: skipped — already seeded (${count.toString()} rows)`);
        return;
    }

    const listRes = await fetch(`${API_BASE}/${resourcePath}`);
    if (!listRes.ok) {
        throw new Error(`Failed to fetch ${resourcePath} list: HTTP ${listRes.status.toString()}`);
    }
    const list = (await listRes.json()) as ApiListResponse;

    const urls = list.results.map((item) => `${API_BASE}/${resourcePath}/${item.index}`);
    const details = await fetchBatch<TApiResponse>(urls, CONCURRENCY_LIMIT, logger);

    const rows = details.map((raw) => mapFn(raw));
    await em.insertMany(entityClass, rows as TEntity[]);

    logger.log(`${label}: inserted ${rows.length.toString()} rows`);
}

export class SrdSeeder {
    private readonly logger: SrdLogger;

    constructor(logger: SrdLogger = console) {
        this.logger = logger;
    }

    async run(em: EntityManager): Promise<void> {
        const seeds: Array<() => Promise<void>> = [
            () => this.seedType<SrdClass, ClassApiResponse>(em, SrdClass, 'classes', mapClass),
            () => this.seedType<SrdRace, RaceApiResponse>(em, SrdRace, 'races', mapRace),
            () => this.seedType<SrdSpell, SpellApiResponse>(em, SrdSpell, 'spells', mapSpell),
            () => this.seedType<SrdMonster, MonsterApiResponse>(em, SrdMonster, 'monsters', mapMonster),
            () => this.seedType<SrdEquipment, EquipmentApiResponse>(em, SrdEquipment, 'equipment', mapEquipment),
            () => this.seedType<SrdCondition, ConditionApiResponse>(em, SrdCondition, 'conditions', mapCondition),
        ];

        for (const seed of seeds) {
            await seed();
        }
    }

    private async seedType<TEntity extends object, TApiResponse>(
        em: EntityManager,
        entityClass: new () => TEntity,
        resourcePath: string,
        mapFn: (raw: TApiResponse) => Partial<TEntity>,
    ): Promise<void> {
        try {
            await seedEntityType(em, this.logger, entityClass, resourcePath, mapFn);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `${entityClass.name}: seed failed — ${message}. ` +
                'Re-run `mikro-orm migration:up` after restoring connectivity.',
            );
        }
    }
}
