import love from 'eslint-config-love'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  {
    ignores: ['dist/**', 'dist-demo/**', 'node_modules/**', 'docs/.vitepress/dist/**']
  },
  {
    ...love,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021
      },
      parser: typescriptEslint.parser,
      parserOptions: {
        project: true,
        tsconfigDirName: import.meta.dirname
      }
    },
    rules: {
      ...love.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off',
    }
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', 'docs/**/*.ts', 'dev/**/*.ts', 'vite.config.ts'],
    extends: [typescriptEslint.configs.disableTypeChecked],
    languageOptions: {
       globals: {
        ...globals.browser,
        ...globals.es2021
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    }
  }
)
