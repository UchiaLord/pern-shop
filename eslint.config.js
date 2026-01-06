import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettier,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'import/order': ['warn', { 'newlines-between': 'always' }]
    }
  }
];
