import createConfig from '@juuso.piikkila/eslint-config-typescript';

export default createConfig({
    vue: true,
    tsconfigPath: './.nuxt/tsconfig.json',
    ignores: ['dist/', 'node_modules/', '.nuxt/', '.output/', '.storybook/', 'storybook-static/', 'vitest.config.ts', 'introspect.d.ts'],
}, {
    files: ['**/*.vue'],
    rules: {
        'canonical/filename-match-regex': 'off',
        'max-len': 'off',
        'vue/require-macro-variable-name': 'off',
    },
}, {
    files: ['**/*.stories.ts'],
    rules: {
        'canonical/filename-match-exported': 'off',
        'canonical/filename-match-regex': 'off',
        '@typescript-eslint/naming-convention': 'off',
    },
}, {
    files: ['composables/useMarkdown.ts'],
    rules: {
        'canonical/filename-match-regex': 'off',
    },
}, {
    files: ['**/*.d.ts'],
    rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
    },
}, {
    files: ['tests/**/*.ts'],
    rules: {
        '@stylistic/member-delimiter-style': 'off',
        'canonical/filename-match-regex': 'off',
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@stylistic/line-comment-position': 'off',
        'id-length': 'off',
        'max-len': 'off',
        'no-inline-comments': 'off',
    },
});
