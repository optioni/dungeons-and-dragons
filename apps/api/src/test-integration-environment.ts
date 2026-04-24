import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface IntegrationTestEnvironment {
    readonly DATABASE_URL: string
    readonly REDIS_URL: string
}

const ENV_FILE_NAME = `dnd-api-integration-${createHash('sha256').update(process.cwd()).digest('hex').slice(0, 12)}.json`;

export function getIntegrationTestEnvironmentPath(): string {
    return process.env['INTEGRATION_TEST_ENV_FILE'] ?? join(tmpdir(), ENV_FILE_NAME);
}

export function writeIntegrationTestEnvironment(environment: IntegrationTestEnvironment): void {
    const environmentPath = getIntegrationTestEnvironmentPath();
    writeFileSync(environmentPath, `${JSON.stringify(environment)}\n`, { encoding: 'utf8' });
}

export function loadIntegrationTestEnvironment(): void {
    const environmentPath = getIntegrationTestEnvironmentPath();

    if (!existsSync(environmentPath)) {
        return;
    }

    const environment = JSON.parse(readFileSync(environmentPath, 'utf8')) as IntegrationTestEnvironment;
    process.env['DATABASE_URL'] = environment.DATABASE_URL;
    process.env['REDIS_URL'] = environment.REDIS_URL;
}

export function getRequiredIntegrationDatabaseUrl(): string {
    return getRequiredIntegrationEnvironmentValue('DATABASE_URL');
}

export function getRequiredIntegrationRedisUrl(): string {
    return getRequiredIntegrationEnvironmentValue('REDIS_URL');
}

export function removeIntegrationTestEnvironment(): void {
    rmSync(getIntegrationTestEnvironmentPath(), { force: true });
}

function getRequiredIntegrationEnvironmentValue(name: keyof IntegrationTestEnvironment): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is required for API integration tests. Run them through yarn test:integration.`);
    }

    return value;
}
