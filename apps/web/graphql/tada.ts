import { initGraphQLTada } from 'gql.tada';

import { type introspection } from '../introspect';

/* eslint-disable @typescript-eslint/naming-convention */
export const graphql = initGraphQLTada<{
    introspection: introspection
    scalars: {
        JSON: unknown
        DateTime: string
    }
}>();
/* eslint-enable @typescript-eslint/naming-convention */
