const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: ['eslint.config.js', 'dist/**'],
  },
  ...tsPlugin.configs['flat/recommended'],
  prettierRecommended,
  {
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/libs/adapters/*', '@libs/adapters/*'],
              message:
                'Depend on the port in libs/ports and inject the core service instead. Only libs/registry.ts may import adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    // The registry is the wiring file — importing adapters is its job.
    // Adapters share a base class, and tests assert which adapter got wired.
    files: [
      'src/libs/registry.ts',
      'src/libs/adapters/**',
      '**/__tests__/**',
      '**/*.spec.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
