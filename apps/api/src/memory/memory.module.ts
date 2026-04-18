import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import VoyageAI from 'voyageai';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { DiaryEntry } from './entities/diary-entry.entity.js';
import { Memory } from './entities/memory.entity.js';
import { ANTHROPIC_CLIENT, BACKGROUND_MODEL, MemoryService } from './memory.service.js';
import { EmbeddingService, VOYAGE_CLIENT } from './embedding.service.js';

/**
 * Owns diary entries, memory facts, Voyage AI embeddings, and pgvector semantic search.
 * Exports `MemoryService` for use by LlmModule and GameEngineModule.
 */
@Module({
    imports: [MikroOrmModule.forFeature([Campaign, DiaryEntry, Memory])],
    providers: [
        {
            provide: VOYAGE_CLIENT,
            useFactory: (config: ConfigService) =>
                new VoyageAI({ apiKey: config.getOrThrow<string>('VOYAGE_API_KEY') }),
            inject: [ConfigService],
        },
        {
            provide: ANTHROPIC_CLIENT,
            useFactory: (config: ConfigService) =>
                new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') }),
            inject: [ConfigService],
        },
        {
            provide: BACKGROUND_MODEL,
            useFactory: (config: ConfigService) =>
                config.getOrThrow<string>('LLM_BACKGROUND_MODEL'),
            inject: [ConfigService],
        },
        EmbeddingService,
        MemoryService,
    ],
    exports: [MemoryService],
})
export class MemoryModule {}
