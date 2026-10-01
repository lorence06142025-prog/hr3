import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'build', 'server', '**/*.config.js', 'public']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-empty': 'off',
      'no-unused-vars': 'warn',
      'no-dupe-keys': 'warn',
      'no-useless-assignment': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
    },
  },
])
