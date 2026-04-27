import 'dotenv/config';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

export default defineConfig({
    metadataProvider: TsMorphMetadataProvider,
    clientUrl: process.env.DATABASE_URL,
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    migrations: {
        path: './migrations',
        pathTs: './src/migrations',
    },
    extensions: [Migrator],
});
