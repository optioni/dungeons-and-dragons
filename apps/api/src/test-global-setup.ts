/* eslint-disable canonical/filename-match-exported */
/**
 * Vitest global setup — runs once in the main process before any test workers start.
 *
 * Starts containerized PostgreSQL and Redis infrastructure, runs migrations, then seeds
 * SRD tables so integration specs can rely on prepared shared state.
 */
// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

import { Migration20260413000000 } from './migrations/Migration20260413000000.js';
import { Migration20260413000001 } from './migrations/Migration20260413000001.js';
import { Migration20260413000002 } from './migrations/Migration20260413000002.js';
import { Migration20260414000000 } from './migrations/Migration20260414000000.js';
import { Migration20260415000000 } from './migrations/Migration20260415000000.js';
import { Migration20260416000000 } from './migrations/Migration20260416000000.js';
import { Migration20260417000000 } from './migrations/Migration20260417000000.js';
import { Migration20260418000000 } from './migrations/Migration20260418000000.js';
import { Migration20260419000000 } from './migrations/Migration20260419000000.js';
import { Migration20260419092811 } from './migrations/Migration20260419092811.js';
import { Migration20260419110000 } from './migrations/Migration20260419110000.js';
import { Migration20260420000000 } from './migrations/Migration20260420000000.js';
import { Migration20260420103919PermadeathCampaignEnd } from './migrations/Migration20260420103919PermadeathCampaignEnd.js';
import { Migration20260421000000 } from './migrations/Migration20260421000000.js';
import { Migration20260421120000 } from './migrations/Migration20260421120000.js';
import { Migration20260423000000 } from './migrations/Migration20260423000000.js';
import { Migration20260424000000 } from './migrations/Migration20260424000000.js';
import { SrdClass } from './srd/entities/srd-class.entity.js';
import { SrdCondition } from './srd/entities/srd-condition.entity.js';
import { SrdEquipment } from './srd/entities/srd-equipment.entity.js';
import { SrdMonster } from './srd/entities/srd-monster.entity.js';
import { SrdRace } from './srd/entities/srd-race.entity.js';
import { SrdSpell } from './srd/entities/srd-spell.entity.js';
import { SrdSeeder } from './srd/srd.seeder.js';
import {
    removeIntegrationTestEnvironment,
    writeIntegrationTestEnvironment,
} from './test-integration-environment.js';

const PGVECTOR_POSTGRES_IMAGE = 'pgvector/pgvector:pg17';
const REDIS_IMAGE = 'redis:7-alpine';
const MIGRATIONS = [
    Migration20260413000000,
    Migration20260413000001,
    Migration20260413000002,
    Migration20260414000000,
    Migration20260415000000,
    Migration20260416000000,
    Migration20260417000000,
    Migration20260418000000,
    Migration20260419000000,
    Migration20260419092811,
    Migration20260419110000,
    Migration20260420000000,
    Migration20260420103919PermadeathCampaignEnd,
    Migration20260421000000,
    Migration20260421120000,
    Migration20260423000000,
    Migration20260424000000,
];

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
            clientUrl: databaseUrl,
            entities: [SrdClass, SrdRace, SrdSpell, SrdMonster, SrdEquipment, SrdCondition],
            migrations: {
                migrationsList: MIGRATIONS,
            },
            extensions: [Migrator],
        }),
    );
}

async function stopContainers(
    postgres: StartedPostgreSqlContainer | undefined,
    redis: StartedRedisContainer | undefined,
): Promise<void> {
    await Promise.allSettled([
        redis?.stop(),
        postgres?.stop(),
    ]);
    removeIntegrationTestEnvironment();
}

function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}
