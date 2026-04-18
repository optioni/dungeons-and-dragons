import { Injectable } from '@nestjs/common';

import { type DmStreamChunk } from './dto/dm-stream-chunk.dto.js';

interface Subscriber {
    queue: DmStreamChunk[];
    resolve: ((value: IteratorResult<DmStreamChunk>) => void) | null;
    done: boolean;
}

/**
 * Session-scoped pub/sub for DM stream chunks. Each session gets its own set of
 * subscribers. Chunks include monotonic sequence numbers so clients can de-duplicate
 * after SSE reconnects.
 */
@Injectable()
export class StreamPublisher {
    private readonly subscribers = new Map<number, Set<Subscriber>>();
    private readonly sequences = new Map<number, number>();

    /** Returns an AsyncIterable that yields chunks for the given session. */
    subscribe(sessionId: number): AsyncIterable<DmStreamChunk> {
        const sub: Subscriber = { queue: [], resolve: null, done: false };

        if (!this.subscribers.has(sessionId)) {
            this.subscribers.set(sessionId, new Set());
        }
        this.subscribers.get(sessionId)!.add(sub);

        const iterator: AsyncIterator<DmStreamChunk> = {
            next: () => {
                if (sub.queue.length > 0) {
                    return Promise.resolve({ value: sub.queue.shift()!, done: false });
                }
                if (sub.done) {
                    return Promise.resolve({ value: undefined as unknown as DmStreamChunk, done: true });
                }
                return new Promise<IteratorResult<DmStreamChunk>>((resolve) => {
                    sub.resolve = resolve;
                });
            },
            return: () => {
                this.subscribers.get(sessionId)?.delete(sub);
                sub.done = true;
                sub.resolve?.({ value: undefined as unknown as DmStreamChunk, done: true });
                return Promise.resolve({ value: undefined as unknown as DmStreamChunk, done: true });
            },
        };

        return { [Symbol.asyncIterator]: () => iterator };
    }

    /** Publishes a chunk to all subscribers of the session. Returns the assigned sequence number. */
    publish(sessionId: number, partial: Omit<DmStreamChunk, 'sequence' | 'sessionId'>): DmStreamChunk {
        const seq = (this.sequences.get(sessionId) ?? 0) + 1;
        this.sequences.set(sessionId, seq);

        const chunk: DmStreamChunk = { ...partial, sequence: seq, sessionId } as DmStreamChunk;
        const subs = this.subscribers.get(sessionId);

        if (subs) {
            for (const sub of subs) {
                if (sub.done) continue;
                if (sub.resolve) {
                    const resolve = sub.resolve;
                    sub.resolve = null;
                    resolve({ value: chunk, done: false });
                } else {
                    sub.queue.push(chunk);
                }
            }
        }

        return chunk;
    }

    /** Closes all subscribers for a session (emits done). */
    complete(sessionId: number): void {
        const subs = this.subscribers.get(sessionId);
        if (!subs) return;
        for (const sub of subs) {
            sub.done = true;
            sub.resolve?.({ value: undefined as unknown as DmStreamChunk, done: true });
        }
        this.subscribers.delete(sessionId);
        this.sequences.delete(sessionId);
    }
}
