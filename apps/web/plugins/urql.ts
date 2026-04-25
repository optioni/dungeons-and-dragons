import {
    defineNuxtPlugin,
    useRouter,
    useRuntimeConfig,
} from '#imports';
import install, { createClient, fetchExchange, mapExchange, subscriptionExchange } from '@urql/vue';
import { createClient as createSSEClient } from 'graphql-sse';

export default defineNuxtPlugin((nuxtApp) => {
    const runtimeConfig = useRuntimeConfig();
    const apiUrl = runtimeConfig.public.apiUrl as string;
    const router = useRouter();

    const exchanges = [
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
        ...(import.meta.client
            ? [
                  subscriptionExchange({
                      forwardSubscription: (request) => {
                          const sseClient = createSSEClient({
                              url: `${apiUrl}/graphql`,
                              fetchFn: (
                                  input: Parameters<typeof fetch>[0],
                                  init?: Parameters<typeof fetch>[1],
                              ) => fetch(input, { ...init, credentials: 'include' }),
                          });
                          return {
                              subscribe: (sink) => ({
                                  unsubscribe: sseClient.subscribe(
                                      { query: request.query ?? '', variables: request.variables },
                                      sink,
                                  ),
                              }),
                          };
                      },
                  }),
              ]
            : []),
    ];

    const urqlClient = createClient({
        url: `${apiUrl}/graphql`,
        fetchOptions: { credentials: 'include' },
        exchanges,
    });

    // Register via @urql/vue's install, which wraps the client in a shallowRef
    nuxtApp.vueApp.use(install, urqlClient);
});
