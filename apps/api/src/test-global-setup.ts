/**
 * Vitest global setup — runs once in the main process before any test workers start.
 *
 * Ensures the SRD tables exist and are seeded so both the character and srd integration
 * specs can rely on the data being present. The srd.integration.spec.ts will then
 * truncate + reseed within its own beforeAll to test the seeder in isolation.
 */
// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';

import { SrdClass } from './srd/entities/srd-class.entity.js';
import { SrdCondition } from './srd/entities/srd-condition.entity.js';
import { SrdEquipment } from './srd/entities/srd-equipment.entity.js';
import { SrdMonster } from './srd/entities/srd-monster.entity.js';
import { SrdRace } from './srd/entities/srd-race.entity.js';
import { SrdSpell } from './srd/entities/srd-spell.entity.js';
import { SrdSeeder } from './srd/srd.seeder.js';

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://dnd:dnd@localhost:5432/dnd';

export default async function setup(): Promise<void> {
    const orm = await MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [SrdClass, SrdRace, SrdSpell, SrdMonster, SrdEquipment, SrdCondition],
        }),
    );

    try {
        const em = orm.em.fork();
        const seeder = new SrdSeeder();
        // Seeder skips if data already exists — safe to call unconditionally
        await seeder.run(em);
    } finally {
        await orm.close();
    }
}
