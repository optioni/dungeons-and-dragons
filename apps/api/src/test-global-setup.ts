/* eslint-disable canonical/filename-match-exported */
/**
 * Vitest global setup — runs once in the main process before any test workers start.
 *
 * Starts containerized PostgreSQL and Redis infrastructure, runs migrations, then seeds
 * SRD tables so integration specs can rely on prepared shared state.
 */
// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { type Constructor, MikroORM } from '@mikro-orm/core';
import { type Migration, Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { require as tsxRequire } from 'tsx/cjs/api';

import { SrdClass } from './srd/entities/srd-class.entity.js';
import { SrdCondition } from './srd/entities/srd-condition.entity.js';
import { SrdEquipment } from './srd/entities/srd-equipment.entity.js';
import { SrdMonster } from './srd/entities/srd-monster.entity.js';
import { SrdRace } from './srd/entities/srd-race.entity.js';
import { SrdSpell } from './srd/entities/srd-spell.entity.js';
import { SrdSeeder } from './srd/srd.seeder.js';
import { removeIntegrationTestEnvironment, writeIntegrationTestEnvironment } from './test-integration-environment.js';

const PGVECTOR_POSTGRES_IMAGE = 'pgvector/pgvector:pg17';
const REDIS_IMAGE = 'redis:7-alpine';
const API_ROOT = process.cwd();

type Teardown = () => Promise<void>;

export default async function setup(): Promise<Teardown> {
    let postgres: StartedPostgreSqlContainer | undefined;
    let redis: StartedRedisContainer | undefined;

    try {
        postgres = await new PostgreSqlContainer(PGVECTOR_POSTGRES_IMAGE)
            .withDatabase('dnd')
            .withUsername('dnd')
            .withPassword('dnd')
            .start();
        redis = await new RedisContainer(REDIS_IMAGE).start();
    } catch (error) {
        await stopContainers(postgres, redis);
        throw new Error(
            `API integration tests require Docker to start ${PGVECTOR_POSTGRES_IMAGE} and ${REDIS_IMAGE} containers. ${formatError(error)}`,
        );
    }

    const databaseUrl = postgres.getConnectionUri();
    const redisUrl = redis.getConnectionUrl();
    process.env['DATABASE_URL'] = databaseUrl;
    process.env['REDIS_URL'] = redisUrl;
    /* eslint-disable @typescript-eslint/naming-convention */
    writeIntegrationTestEnvironment({
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    const orm = await createMigratingOrm(databaseUrl);

    try {
        await orm.migrator.up();
        const em = orm.em.fork();
        const seeder = new SrdSeeder();
        // Seeder skips if data already exists — safe to call unconditionally
        await seeder.run(em);
    } finally {
        await orm.close();
    }

    return async () => {
        removeIntegrationTestEnvironment();
        await stopContainers(postgres, redis);
    };
}

async function createMigratingOrm(databaseUrl: string): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            baseDir: API_ROOT,
            clientUrl: databaseUrl,
            entities: [SrdClass, SrdRace, SrdSpell, SrdMonster, SrdEquipment, SrdCondition],
            migrations: {
                migrationsList: loadMigrations(),
            },
            extensions: [Migrator],
        }),
    );
}

function loadMigrations(): Array<Constructor<Migration>> {
    const migrationsPath = join(API_ROOT, 'src/migrations');

    return readdirSync(migrationsPath)
        .filter((fileName) => /^Migration.*\.ts$/u.test(fileName))
        .sort()
        .map((fileName) => {
            const modulePath = join(migrationsPath, fileName);
            const migrationModule = tsxRequire(modulePath, join(API_ROOT, 'src/test-global-setup.ts')) as Record<
                string,
                unknown
            >;
            const MigrationClass = Object.values(migrationModule).find(isMigrationConstructor);

            if (!MigrationClass) {
                throw new Error(`No MikroORM migration class exported by ${modulePath}`);
            }

            return MigrationClass;
        });
}

function isMigrationConstructor(value: unknown): value is Constructor<Migration> {
    return typeof value === 'function';
}

async function stopContainers(
    postgres: StartedPostgreSqlContainer | undefined,
    redis: StartedRedisContainer | undefined,
): Promise<void> {
    await Promise.allSettled([redis?.stop(), postgres?.stop()]);
    removeIntegrationTestEnvironment();
}

function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}
