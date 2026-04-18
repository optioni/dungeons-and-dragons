import { createClient, fetchExchange, mapExchange, subscriptionExchange } from '@urql/vue';
import { createClient as createSSEClient } from 'graphql-sse';

export default defineNuxtPlugin(() => {
    const runtimeConfig = useRuntimeConfig();
    const apiUrl = runtimeConfig.public.apiUrl as string;
    const router = useRouter();

    const sseClient = createSSEClient({
        url: `${apiUrl}/graphql`,
        fetchOptions: { credentials: 'include' },
    });

    const urqlClient = createClient({
        url: `${apiUrl}/graphql`,
        fetchOptions: { credentials: 'include' },
        exchanges: [
            mapExchange({
                onError(error) {
                    const isUnauthorized = error.graphQLErrors.some(
                        (graphqlError) => graphqlError.extensions?.['code'] === 'UNAUTHORIZED',
                    );
                    if (isUnauthorized) {
                        router.push('/auth');
                    }
                },
            }),
            fetchExchange,
            subscriptionExchange({
                forwardSubscription: (request) => ({
                    subscribe: (sink) => ({
                        unsubscribe: sseClient.subscribe(
                            { query: request.query ?? '', variables: request.variables },
                            sink,
                        ),
                    }),
                }),
            }),
        ],
    });

    return {
        provide: {
            urql: urqlClient,
        },
    };
});
