import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    afterAll, afterEach, describe, expect, it,
} from 'vitest';

import {
    getIntegrationTestEnvironmentPath,
    getRequiredIntegrationDatabaseUrl,
    getRequiredIntegrationRedisUrl,
    loadIntegrationTestEnvironment,
    removeIntegrationTestEnvironment,
    writeIntegrationTestEnvironment,
} from './test-integration-environment.js';

describe('integration test environment handoff', () => {
    const originalEnvironment = { ...process.env };
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'dnd-api-integration-env-'));
    const environmentPath = join(temporaryDirectory, 'env.json');

    afterEach(() => {
        process.env = { ...originalEnvironment };
        rmSync(environmentPath, { force: true });
        mkdirSync(temporaryDirectory, { recursive: true });
    });

    it('writes and loads dynamic database and Redis URLs', () => {
        process.env['INTEGRATION_TEST_ENV_FILE'] = environmentPath;
        delete process.env['DATABASE_URL'];
        delete process.env['REDIS_URL'];

        /* eslint-disable @typescript-eslint/naming-convention */
        writeIntegrationTestEnvironment({
            DATABASE_URL: 'postgresql://test:test@localhost:15432/test',
            REDIS_URL: 'redis://localhost:16379',
        });
        /* eslint-enable @typescript-eslint/naming-convention */
        loadIntegrationTestEnvironment();

        expect(process.env['DATABASE_URL']).toBe('postgresql://test:test@localhost:15432/test');
        expect(process.env['REDIS_URL']).toBe('redis://localhost:16379');
    });

    it('uses a deterministic temporary file path by default', () => {
        delete process.env['INTEGRATION_TEST_ENV_FILE'];

        expect(getIntegrationTestEnvironmentPath()).toContain(tmpdir());
        expect(getIntegrationTestEnvironmentPath()).toContain('dnd-api-integration-');
    });

    it('removes generated handoff state', () => {
        process.env['INTEGRATION_TEST_ENV_FILE'] = environmentPath;

        /* eslint-disable @typescript-eslint/naming-convention */
        writeIntegrationTestEnvironment({
            DATABASE_URL: 'postgresql://test:test@localhost:15432/test',
            REDIS_URL: 'redis://localhost:16379',
        });
        /* eslint-enable @typescript-eslint/naming-convention */
        removeIntegrationTestEnvironment();
        delete process.env['DATABASE_URL'];
        delete process.env['REDIS_URL'];
        loadIntegrationTestEnvironment();

        expect(process.env['DATABASE_URL']).toBeUndefined();
        expect(process.env['REDIS_URL']).toBeUndefined();
    });

    it('fails clearly when a required integration environment value is missing', () => {
        delete process.env['DATABASE_URL'];
        delete process.env['REDIS_URL'];

        expect(() => getRequiredIntegrationDatabaseUrl()).toThrow('DATABASE_URL is required for API integration tests');
        expect(() => getRequiredIntegrationRedisUrl()).toThrow('REDIS_URL is required for API integration tests');
    });

    afterAll(() => {
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });
});
