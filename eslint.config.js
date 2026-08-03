import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactCompilerPlugin from 'eslint-plugin-react-compiler';
import globals from 'globals';

export default [
  // Base recommended config
  js.configs.recommended,

  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'build/**'],
  },

  // JavaScript/JSX configuration
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'react-compiler': reactCompilerPlugin,
    },
    rules: {
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,

      // Custom rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'warn',
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      'react-compiler/react-compiler': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // TypeScript configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'react-compiler': reactCompilerPlugin,
    },
    rules: {
      // TypeScript recommended rules
      ...tseslint.configs.recommended.rules,

      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,

      // Custom rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off', // TypeScript handles this
      'no-console': 'warn',
      'no-undef': 'off', // TypeScript catches this; false positives on types/ambient globals
      'no-unused-vars': 'off', // Use TypeScript version
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      'react-compiler/react-compiler': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Test files configuration
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
