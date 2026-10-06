import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'phase0-prototype/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'chrome', 'window', 'document', 'navigator'],
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'react-dom/client'],
          patterns: ['**/background/**', '**/content/**', '**/popup/**'],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
