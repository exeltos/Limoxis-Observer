import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// TypeScript files get the same React rules as JavaScript, parsed by the
// TypeScript parser, plus the non-type-checked typescript-eslint recommended set.
const tsFiles = (patterns, config) => [
  ...tseslint.configs.recommended.map(c => ({ ...c, files: patterns })),
  { files: patterns, ...config },
]
const srcConfig = {
  languageOptions: { ecmaVersion: 2024, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: globals.browser },
  plugins: { react, 'react-hooks': reactHooks },
  settings: { react: { version: 'detect' } },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off'
  }
}
const testsConfig = {
  languageOptions: { ecmaVersion: 2024, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.node, ...globals.browser } },
  plugins: { react },
  settings: { react: { version: 'detect' } },
  rules: { 'react/jsx-uses-vars': 'error' }
}
const tsUnusedVars = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
}

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  { files: ['src/**/*.{js,jsx}'], ...srcConfig },
  ...tsFiles(['src/**/*.{ts,tsx}'], { ...srcConfig, rules: { ...srcConfig.rules, ...tsUnusedVars } }),
  { files: ['tests/**/*.{js,jsx}'], ...testsConfig },
  ...tsFiles(['tests/**/*.{ts,tsx}'], { ...testsConfig, rules: { ...testsConfig.rules, ...tsUnusedVars } })
]
