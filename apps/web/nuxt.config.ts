import { defineNuxtConfig } from 'nuxt/config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    modules: ['@nuxt/ui'],
    ui: {
        colors: {
            neutral: 'stone',
        },
    },
    css: [
        '@fontsource/im-fell-english/400.css',
        '@fontsource/im-fell-english/400-italic.css',
        '@fontsource/cinzel/400.css',
        '~/assets/css/main.css',
    ],
    compatibilityDate: '2025-01-01',
    runtimeConfig: {
        public: {
            apiUrl: process.env.NUXT_PUBLIC_API_URL ?? 'http://localhost:3000',
        },
    },
    devServer: {
        port: Number(process.env.NUXT_PORT ?? 4000),
    },
});
