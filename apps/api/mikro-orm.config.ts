import 'dotenv/config';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
    metadataProvider: TsMorphMetadataProvider,
    clientUrl: process.env.DATABASE_URL,
    entities: ['./dist/src/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    migrations: {
        path: './migrations',
        pathTs: './src/migrations',
    },
    extensions: [Migrator],
});
