import createConfig from '@juuso.piikkila/eslint-config-typescript';
// eslint-disable-next-line import/no-extraneous-dependencies
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default createConfig({
  graphql: true,
  tsconfigPath: './tsconfig.json',
  ignores: ['dist/', 'node_modules/', 'migrations/', 'src/migrations/'],
}, {
    rules: {
        '@stylistic/line-comment-position': 'off',
        'no-inline-comments': 'off',
    },
}, eslintConfigPrettier);
