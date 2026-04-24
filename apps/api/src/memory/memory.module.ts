import Anthropic from '@anthropic-ai/sdk';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoyageAIClient } from 'voyageai';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { EmbeddingService, VOYAGE_CLIENT } from './embedding.service.js';
import { DiaryEntry } from './entities/diary-entry.entity.js';
import { Memory } from './entities/memory.entity.js';
import { MemoryResolver } from './memory.resolver.js';
import { ANTHROPIC_CLIENT, BACKGROUND_MODEL, MemoryService } from './memory.service.js';

/**
 * Owns diary entries, memory facts, Voyage AI embeddings, and pgvector semantic search.
 * Exports `MemoryService` for use by LlmModule and GameEngineModule.
 */
@Module({
    imports: [
        GraphqlModule,
        MikroOrmModule.forFeature([Campaign, DiaryEntry, Memory]),
    ],
    providers: [
        {
            provide: VOYAGE_CLIENT,
            useFactory: (config: ConfigService) => new VoyageAIClient({ apiKey: config.getOrThrow<string>('VOYAGE_API_KEY') }),
            inject: [ConfigService],
        },
        {
            provide: ANTHROPIC_CLIENT,
            useFactory: (config: ConfigService) => new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') }),
            inject: [ConfigService],
        },
        {
            provide: BACKGROUND_MODEL,
            useFactory: (config: ConfigService) => config.getOrThrow<string>('LLM_BACKGROUND_MODEL'),
            inject: [ConfigService],
        },
        EmbeddingService,
        MemoryService,
        MemoryResolver,
    ],
    exports: [MemoryService],
})
export class MemoryModule {}
