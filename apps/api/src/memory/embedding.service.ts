import { Inject, Injectable, Logger } from '@nestjs/common';
import { VoyageAIClient } from 'voyageai';

export const VOYAGE_CLIENT = Symbol('VOYAGE_CLIENT');

type VoyageClient = Pick<VoyageAIClient, 'embed'>;

/**
 * Generates text embeddings via the Voyage AI SDK (`voyage-3-large` model).
 * Returns null on failure so callers can persist records without embeddings.
 */
@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);

    constructor(@Inject(VOYAGE_CLIENT) private readonly client: VoyageClient) {}

    async generateEmbedding(text: string): Promise<number[] | null> {
        const callStartedAt = Date.now();
        try {
            const result = await this.client.embed({
                input: [text],
                model: 'voyage-3-large',
            });
            const embedding = (result.data?.[0] as { embedding: number[] } | undefined)?.embedding ?? null;
            const duration = Date.now() - callStartedAt;
            this.logger.log(`Voyage AI call complete: provider=voyage model=voyage-3-large inputCount=1 duration=${duration}ms success=${embedding !== null}`);
            return embedding;
        } catch (error) {
            const duration = Date.now() - callStartedAt;
            const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
            this.logger.error(`Voyage AI call failed: provider=voyage model=voyage-3-large inputCount=1 duration=${duration}ms errorClass=${errorClass}`);
            return null;
        }
    }
}
