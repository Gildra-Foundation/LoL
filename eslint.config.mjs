import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/.next/**', '**/node_modules/**', '**/next-env.d.ts', '**/data/**', '**/archive/**'] },
  { files: ['**/*.{ts,tsx}'], extends: [js.configs.recommended, ...ts.configs.recommended],
    rules: { '@typescript-eslint/no-explicit-any': 'warn', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
);
