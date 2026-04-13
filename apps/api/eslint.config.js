import createConfig from '@juuso.piikkila/eslint-config-typescript';

export default createConfig({
  graphql: true,
  tsconfigPath: './tsconfig.json',
  ignores: ['dist/', 'node_modules/', 'migrations/', 'src/migrations/'],
});
