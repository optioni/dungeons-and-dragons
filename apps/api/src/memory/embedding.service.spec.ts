import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { EmbeddingService } from './embedding.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
    Inject: () => () => {},
    Logger: class {
        error = vi.fn();
    },
}));
/* eslint-enable @typescript-eslint/naming-convention */

function makeClient(embedResult: unknown = null, throws = false) {
    return {
        embed: vi.fn().mockImplementation(() => {
            if (throws) {
                return Promise.reject(new Error('API quota exceeded'));
            }

            return Promise.resolve(embedResult);
        }),
    };
}

describe('EmbeddingService', () => {
    let service: EmbeddingService;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns number[] when voyage AI embed succeeds', async () => {
        const embedding = Array.from({ length: 1024 }, (_, index) => index * 0.001);
        const client = makeClient({ data: [{ embedding }] });
        service = new EmbeddingService(client as never);

        const result = await service.generateEmbedding('test text');

        expect(result).toEqual(embedding);
        expect(client.embed).toHaveBeenCalledWith({
            input: ['test text'],
            model: 'voyage-3-large',
        });
    });

    it('returns null when voyage AI API call throws', async () => {
        const client = makeClient(null, true);
        service = new EmbeddingService(client as never);

        const result = await service.generateEmbedding('test text');

        expect(result).toBeNull();
    });

    it('returns null when embed result has no data', async () => {
        const client = makeClient({ data: [] });
        service = new EmbeddingService(client as never);

        const result = await service.generateEmbedding('test text');

        expect(result).toBeNull();
    });
});
