import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    afterAll, afterEach, describe, expect, it,
} from 'vitest';

import {
    getRequiredIntegrationDatabaseUrl,
    getRequiredIntegrationRedisUrl,
    getIntegrationTestEnvironmentPath,
    loadIntegrationTestEnvironment,
    removeIntegrationTestEnvironment,
    writeIntegrationTestEnvironment,
} from './test-integration-environment.js';

describe('integration test environment handoff', () => {
    const originalEnv = { ...process.env };
    const tempDir = mkdtempSync(join(tmpdir(), 'dnd-api-integration-env-'));
    const envPath = join(tempDir, 'env.json');

    afterEach(() => {
        process.env = { ...originalEnv };
        rmSync(envPath, { force: true });
        mkdirSync(tempDir, { recursive: true });
    });

    it('writes and loads dynamic database and Redis URLs', () => {
        process.env['INTEGRATION_TEST_ENV_FILE'] = envPath;
        delete process.env['DATABASE_URL'];
        delete process.env['REDIS_URL'];

        writeIntegrationTestEnvironment({
            DATABASE_URL: 'postgresql://test:test@localhost:15432/test',
            REDIS_URL: 'redis://localhost:16379',
        });
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
        process.env['INTEGRATION_TEST_ENV_FILE'] = envPath;

        writeIntegrationTestEnvironment({
            DATABASE_URL: 'postgresql://test:test@localhost:15432/test',
            REDIS_URL: 'redis://localhost:16379',
        });
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
        rmSync(tempDir, { recursive: true, force: true });
    });
});
