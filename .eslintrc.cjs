/**
 * Root ESLint config. Packages under packages/* and apps/api inherit this via
 * ESLint's directory cascade (they have no local config). apps/web declares its
 * own root config (next/core-web-vitals) which stops the cascade there.
 */
module.exports = {
  root: true,
  extends: ['./packages/config/eslint-preset.js'],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '**/generated/**',
    'apps/web/**',
  ],
};
