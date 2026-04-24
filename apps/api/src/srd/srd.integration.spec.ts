// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { defineConfig, MikroORM } from '@mikro-orm/postgresql';
import {
    afterAll, beforeAll, describe, expect, it,
} from 'vitest';

import { getRequiredIntegrationDatabaseUrl } from '../test-integration-environment.js';
import { SrdClass } from './entities/srd-class.entity.js';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdEquipment } from './entities/srd-equipment.entity.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdRace } from './entities/srd-race.entity.js';
import { SrdSpell } from './entities/srd-spell.entity.js';
import { SrdSeeder } from './srd.seeder.js';

const DB_URL = getRequiredIntegrationDatabaseUrl();
const SRD_ENTITIES = [SrdClass, SrdRace, SrdSpell, SrdMonster, SrdEquipment, SrdCondition];

let sharedOrm: MikroORM;

beforeAll(async () => {
    sharedOrm = await MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: SRD_ENTITIES,
        }),
    );

    await sharedOrm.em.getConnection().execute(`
        TRUNCATE TABLE
            srd_condition,
            srd_equipment,
            srd_monster,
            srd_spell,
            srd_race,
            srd_class
        RESTART IDENTITY CASCADE
    `);

    // Seed data so all tests in this file can rely on it being present
    const em = sharedOrm.em.fork();
    const seeder = new SrdSeeder();
    await seeder.run(em);
}, 120_000);

afterAll(async () => {
    // Do not drop the SRD tables — other integration spec files (e.g. character) rely
    // on the seeded SRD data being present. The next test run will call refreshDatabase
    // which drops and recreates cleanly.
    if (sharedOrm) {
        await sharedOrm.close();
    }
});

describe('SrdSeeder integration', () => {
    it('populates all six SRD entity types with rows from dnd5eapi.co', async () => {
        const em = sharedOrm.em.fork();

        const [classes, races, spells, monsters, equipment, conditions] = await Promise.all([
            em.count(SrdClass),
            em.count(SrdRace),
            em.count(SrdSpell),
            em.count(SrdMonster),
            em.count(SrdEquipment),
            em.count(SrdCondition),
        ]);

        expect(classes).toBeGreaterThan(0);
        expect(races).toBeGreaterThan(0);
        expect(spells).toBeGreaterThan(0);
        expect(monsters).toBeGreaterThan(0);
        expect(equipment).toBeGreaterThan(0);
        expect(conditions).toBeGreaterThan(0);
    });

    it('is idempotent — re-running does not duplicate rows', async () => {
        const em = sharedOrm.em.fork();
        const countBefore = await em.count(SrdSpell);

        const seeder = new SrdSeeder();
        await seeder.run(em);

        const countAfter = await em.count(SrdSpell);
        expect(countAfter).toBe(countBefore);
    });
});

describe('SrdSpellResolver integration — query by index', () => {
    it('returns the fireball spell with correct fields', async () => {
        const em = sharedOrm.em.fork();
        const spellRepo = em.getRepository(SrdSpell);

        const fireball = await spellRepo.findOne({ index: 'fireball' });

        expect(fireball).not.toBeNull();
        expect(fireball!.index).toBe('fireball');
        expect(fireball!.name).toBe('Fireball');
        expect(fireball!.level).toBe(3);
        expect(fireball!.school).toBe('Evocation');
        expect(fireball!.components).toContain('V');
        expect(fireball!.components).toContain('S');
        expect(fireball!.components).toContain('M');
        expect(fireball!.classes).toContain('Wizard');
        expect(fireball!.description.length).toBeGreaterThan(0);
    });
});
