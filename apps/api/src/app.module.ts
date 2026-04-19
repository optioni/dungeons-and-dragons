import { YogaDriver, type YogaDriverConfig } from '@graphql-yoga/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { defineConfig } from '@mikro-orm/postgresql';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';

import { AppResolver } from './app.resolver';
import { AuthModule } from './auth/auth.module';
import { CampaignModule } from './campaign/campaign.module';
import { CharacterModule } from './character/character.module';
import { validate } from './config/environment.validation';
import { GameEngineModule } from './game-engine/game-engine.module';
import { GraphqlModule } from './graphql/graphql.module';
import { LlmModule } from './llm/llm.module';
import { MemoryModule } from './memory/memory.module';
import { QuestModule } from './quest/quest.module';
import { QueueModule } from './queue/queue.module';
import { SessionModule } from './session/session.module';
import { SrdModule } from './srd/srd.module';
import { WorldModule } from './world/world.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate,
        }),
        GraphQLModule.forRoot<YogaDriverConfig>({
            driver: YogaDriver,
            autoSchemaFile: true,
            context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        }),
        MikroOrmModule.forRootAsync({
            useFactory: (configService: ConfigService) => defineConfig({
                clientUrl: configService.getOrThrow<string>('DATABASE_URL'),
                entities: ['./dist/src/**/*.entity.js'],
                entitiesTs: ['./src/**/*.entity.ts'],
                migrations: {
                    path: './migrations',
                    pathTs: './src/migrations',
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
                connection: {
                    url: configService.getOrThrow<string>('REDIS_URL'),
                },
            }),
            inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        GraphqlModule,
        AuthModule,
        SrdModule,
        CharacterModule,
        CampaignModule,
        WorldModule,
        SessionModule,
        LlmModule,
        MemoryModule,
        GameEngineModule,
        QuestModule,
        QueueModule,
    ],
    providers: [AppResolver],
})
export class AppModule {}
