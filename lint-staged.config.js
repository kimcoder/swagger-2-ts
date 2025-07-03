/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*': 'prettier --write',
  '*.{js,ts}': 'vitest related --run',
};
