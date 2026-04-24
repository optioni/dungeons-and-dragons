import { initGraphQLTada } from 'gql.tada';

// eslint-disable-next-line import/consistent-type-specifier-style, canonical/prefer-inline-type-import, perfectionist/sort-imports
import type { introspection } from '../introspect';

/* eslint-disable @typescript-eslint/naming-convention */
export const graphql = initGraphQLTada<{
    introspection: introspection
    scalars: {
        JSON: unknown
        DateTime: string
    }
}>();
/* eslint-enable @typescript-eslint/naming-convention */
