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
import { defineConfig, type MikroORM as PostgreSqlMikroORM } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

import { SrdSeeder } from './srd/srd.seeder.js';
import {
    removeIntegrationTestEnvironment,
    writeIntegrationTestEnvironment,
} from './test-integration-environment.js';

const PGVECTOR_POSTGRES_IMAGE = 'pgvector/pgvector:pg17';
const REDIS_IMAGE = 'redis:7-alpine';

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
    writeIntegrationTestEnvironment({
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
    });

    const orm = await createMigratingOrm(databaseUrl);

    try {
        await orm.getMigrator().up();
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

async function createMigratingOrm(databaseUrl: string): Promise<PostgreSqlMikroORM> {
    return MikroORM.init(
        defineConfig({
            metadataProvider: TsMorphMetadataProvider,
            clientUrl: databaseUrl,
            entities: ['./dist/src/**/*.entity.js'],
            entitiesTs: ['./src/**/*.entity.ts'],
            migrations: {
                path: './migrations',
                pathTs: './src/migrations',
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
