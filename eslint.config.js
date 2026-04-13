import createConfig from '@juuso.piikkila/eslint-config-typescript';

export default createConfig({
  ignores: ['dist/', 'node_modules/', '.yarn/'],
});
