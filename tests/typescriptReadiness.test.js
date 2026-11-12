import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readSource, resolveSource, sourceExists } from './helpers/readSource'

describe('TypeScript, step 1: the tests and the tools follow a file that changes extension', () => {
  it('a test that names the old .js file reads the .ts file that replaced it', () => {
    expect(resolveSource('src/core/dates/hospitalDate.js')).toMatch(/src\/core\/dates\/hospitalDate\.ts$/)
    expect(readSource('src/core/dates/hospitalDate.js')).toContain('export function hospitalDate(value: Date | string | number = new Date()): IsoDay')
    expect(sourceExists('src/core/dates/hospitalDate.ts')).toBe(true)
  })
  it('the TypeScript files are checked by the strict compiler run and by ESLint', () => {
    expect(readSource('tsconfig.strict.json')).toContain('src/core/dates/**/*.ts')
    const eslint = readSource('eslint.config.js')
    expect(eslint).toContain("files: ['src/**/*.{ts,tsx}']")
    expect(eslint).toContain("'src/core/supabase/database.types.ts'")
  })
  it('step 2: the design system is TypeScript and in the strict compiler run', () => {
    const files = fs.readdirSync(new URL('../src/design-system/', import.meta.url)).filter(name => /\.(js|jsx|ts|tsx)$/.test(name))
    expect(files.length).toBeGreaterThan(70)
    expect(files.filter(name => /\.jsx?$/.test(name))).toEqual([])
    const strict = readSource('tsconfig.strict.json')
    expect(strict).toContain('src/design-system/**/*')
    expect(strict).toContain('src/types/**/*.d.ts')
    // The language and feedback contexts declare their value for the typed callers.
    expect(readSource('src/core/i18n/LanguageContext.jsx')).toContain("import('./languageTypes').LanguageContextValue")
    expect(readSource('src/core/feedback/FeedbackContext.jsx')).toContain("import('./feedbackTypes').FeedbackContextValue")
  })
  it('the database types exist without the per-register dynamic tables', () => {
    const types = readSource('src/core/supabase/database.types.ts')
    expect(types).toContain('export type Database = {')
    expect(types).toContain('      organizations: {')
    expect(types).not.toMatch(/^ {6}register_[a-z]+_[0-9a-f]{8}: \{$/m)
  })
  it('the audit tools read the source through the same resolution', () => {
    expect(readSource('tools/readSource.mjs')).toContain("export const SOURCE_FILE = /\\.(js|jsx|ts|tsx)$/")
    expect(readSource('tools/check-react-hooks-smoke.mjs')).toContain('SOURCE_FILE')
  })
})
