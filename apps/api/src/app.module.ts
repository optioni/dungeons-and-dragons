import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';

import { AppResolver } from './app.resolver';
import { validate } from './config/environment.validation';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate,
        }),
        GraphQLModule.forRoot<YogaDriverConfig>({
            driver: YogaDriver,
            autoSchemaFile: true,
        }),
        MikroOrmModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
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
    ],
    providers: [AppResolver],
})
export class AppModule {}
