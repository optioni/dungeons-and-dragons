import KeyvRedis from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Registers the `world-tick` BullMQ queue, a Redis-backed CacheModule, and an
 * ioredis client. Import this module to access all three without re-declaring.
 */
@Module({
    imports: [
        BullModule.registerQueue({ name: 'world-tick' }),
        CacheModule.registerAsync({
            useFactory: (config: ConfigService) => ({
                stores: [new KeyvRedis(config.getOrThrow<string>('REDIS_URL'))],
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')),
            inject: [ConfigService],
        },
    ],
    exports: [BullModule, CacheModule, REDIS_CLIENT],
})
export class QueueModule {}
