import { Inject, Injectable, Logger } from '@nestjs/common';
import VoyageAI from 'voyageai';

export const VOYAGE_CLIENT = Symbol('VOYAGE_CLIENT');

type VoyageClient = Pick<VoyageAI, 'embed'>;

/**
 * Generates text embeddings via the Voyage AI SDK (`voyage-3-large` model).
 * Returns null on failure so callers can persist records without embeddings.
 */
@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);

    constructor(@Inject(VOYAGE_CLIENT) private readonly client: VoyageClient) {}

    async generateEmbedding(text: string): Promise<number[] | null> {
        try {
            const result = await this.client.embed({
                input: [text],
                model: 'voyage-3-large',
            });
            return (result.data[0] as { embedding: number[] } | undefined)?.embedding ?? null;
        } catch (error) {
            this.logger.error('Voyage AI embedding failed', error);
            return null;
        }
    }
}
