import createConfig from '@juuso.piikkila/eslint-config-typescript';

export default createConfig({
    vue: true,
    tsconfigPath: './tsconfig.json',
    ignores: ['dist/', 'node_modules/', '.nuxt/', '.output/'],
});
