import {
    describe, expect, it, vi,
} from 'vitest';

import { DmStreamChunkType } from './dto/dm-stream-chunk.dto';
import { StreamPublisher } from './stream-publisher.service';

function makePublisher(): StreamPublisher {
    return new StreamPublisher();
}

describe('StreamPublisher', () => {
    describe('subscribe', () => {
        it('returns an async iterable that yields published chunks', async () => {
            const publisher = makePublisher();
            const iterable = publisher.subscribe(1);
            const chunks: unknown[] = [];

            const iterating = (async () => {
                for await (const chunk of iterable) {
                    chunks.push(chunk);
                    if ((chunk as { type: string }).type === DmStreamChunkType.DONE) {
                        break;
                    }
                }
            })();

            publisher.publish(1, { type: DmStreamChunkType.DONE });
            await iterating;

            expect(chunks).toHaveLength(1);
            expect((chunks[0] as { type: string }).type).toBe(DmStreamChunkType.DONE);
        });
    });

    describe('logging', () => {
        it('logs subscribe with session ID and subscriber count', () => {
            const publisher = makePublisher();
            const logger = (publisher as unknown as Record<string, { log: ReturnType<typeof vi.fn> }>)['logger'];
            const logSpy = vi.spyOn(logger, 'log');

            publisher.subscribe(42);

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('sessionId=42'),
            );
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('subscribers=1'),
            );
        });

        it('logs unsubscribe with remaining subscriber count when iterator is returned', async () => {
            const publisher = makePublisher();
            const logger = (publisher as unknown as Record<string, { log: ReturnType<typeof vi.fn> }>)['logger'];
            const logSpy = vi.spyOn(logger, 'log');

            const iterable = publisher.subscribe(5);
            const iterator = iterable[Symbol.asyncIterator]();
            await iterator.return?.();

            const unsubLogs = (logSpy.mock.calls as string[][]).filter(
                ([message]) => message.includes('unsubscribed'),
            );
            expect(unsubLogs.length).toBeGreaterThan(0);
            expect(unsubLogs[0][0]).toContain('sessionId=5');
            expect(unsubLogs[0][0]).toContain('remainingSubscribers=0');
        });

        it('warns when publishing to a session with no subscribers', () => {
            const publisher = makePublisher();
            const logger = (publisher as unknown as Record<string, { warn: ReturnType<typeof vi.fn> }>)['logger'];
            const warnSpy = vi.spyOn(logger, 'warn');

            publisher.publish(99, { type: DmStreamChunkType.DONE });

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('sessionId=99'),
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('no subscribers'),
            );
        });
    });
});
