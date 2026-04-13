import { createClient, fetchExchange, subscriptionExchange } from '@urql/vue';
import { createClient as createSSEClient } from 'graphql-sse';

export default defineNuxtPlugin(() => {
    const runtimeConfig = useRuntimeConfig();
    const apiUrl = runtimeConfig.public.apiUrl as string;

    const sseClient = createSSEClient({
        url: `${apiUrl}/graphql`,
    });

    const urqlClient = createClient({
        url: `${apiUrl}/graphql`,
        exchanges: [
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
