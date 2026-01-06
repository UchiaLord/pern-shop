import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'warn',
        { 'newlines-between': 'always', alphabetize: { order: 'asc' } }
      ]
    }
  },
  prettier
];
