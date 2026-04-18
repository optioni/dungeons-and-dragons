import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.integration.spec.ts'],
        setupFiles: ['./src/test-setup.ts'],
        // globalSetup runs once before any worker starts, ensuring SRD tables are seeded
        // before the character spec (which needs srd_race/srd_class) starts.
        globalSetup: ['./src/test-global-setup.ts'],
        // Run test files sequentially: srd spec drops+recreates SRD tables as part of its
        // own setup; all other specs need those tables to already exist.
        fileParallelism: false,
    },
});
