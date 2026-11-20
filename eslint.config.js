import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      'apps/api/src/generated',
      'apps/web/tsconfig*.tsbuildinfo',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/vite.config.ts'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'jsx-a11y/label-has-associated-control': [
        'error',
        { depth: 3, controlComponents: ['Input', 'Select', 'Textarea'] },
      ],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // API e pacote compartilhado: Node, sem regras de React.
    // `_` na frente marca parâmetro/variável omitido de propósito.
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
)
