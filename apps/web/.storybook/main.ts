import type { StorybookConfig } from '@nuxtjs/storybook';

export default {
    stories: ['../components/**/*.stories.ts'],
    addons: [],
    framework: {
        name: '@storybook-vue/nuxt',
        options: {},
    },
} satisfies StorybookConfig;
