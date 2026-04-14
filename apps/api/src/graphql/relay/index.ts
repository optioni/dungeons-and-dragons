import { type ConnectionArgs } from './connection-args';

export { ConnectionArgs } from './connection-args';
export * from './connection.factory';
export * from './order-by.input';
export * from './page-info';

interface PagingForward {
    pagingType: 'forward';
    after?: string;
    first: number;
}

interface PagingBackward {
    pagingType: 'backward';
    before?: string;
    last: number;
}

interface PagingNone {
    pagingType: 'none';
}

type PagingMeta = PagingForward | PagingBackward | PagingNone;

/**
 * Get pagination metadata
 */
export function getMeta({ first = 0, last = 0, after, before }: ConnectionArgs): PagingMeta {
    const isForwardPaging = Boolean(first) || Boolean(after);
    const isBackwardPaging = Boolean(last) || Boolean(before);

    if (isForwardPaging) {
        return {
            pagingType: 'forward',
            after,
            first,
        };
    }

    if (isBackwardPaging) {
        return {
            pagingType: 'backward',
            before,
            last,
        };
    }

    return {
        pagingType: 'none',
    };
}
