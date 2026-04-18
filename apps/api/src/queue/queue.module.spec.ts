// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { describe, expect, it } from 'vitest';

import { QueueModule, REDIS_CLIENT } from './queue.module';

describe('QueueModule', () => {
    it('exports BullModule, CacheModule, and REDIS_CLIENT', () => {
        const metadata: unknown[] = Reflect.getMetadata('exports', QueueModule);
        expect(metadata).toContain(BullModule);
        expect(metadata).toContain(CacheModule);
        expect(metadata).toContain(REDIS_CLIENT);
    });

    it('registers the world-tick queue name', () => {
        const queues: unknown[] = Reflect.getMetadata('imports', QueueModule) ?? [];
        const queueImport = queues.find(
            (q) =>
                q != null &&
                typeof q === 'object' &&
                'module' in q &&
                (q as { module: unknown }).module === BullModule,
        );
        expect(queueImport).toBeDefined();
    });
});
