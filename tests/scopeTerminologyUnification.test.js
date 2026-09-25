import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// The P0 terminology PR deliberately standardized "scope" as "Εύρος"
// (departmentScope: 'Εύρος τμήματος'). A later cleanup pass introduced a
// second, inconsistent translation ("Πεδίο") for the same English concept
// in several other files — this fixes that drift back to one term.
describe('unified "scope" terminology (Εύρος, not Πεδίο)', () => {
  it('keeps the established scope translation in the core dictionary', () => {
    const i18n = read('src/core/i18n/LanguageContext.jsx')
    expect(i18n).toContain("scope:'Εύρος'")
    expect(i18n).toContain("departmentScope:'Εύρος τμήματος'")
    expect(i18n).toContain("scopeLabel:'Εύρος'")
    expect(i18n).toContain("usageScopeLabel:'Εύρος χρήσης'")
    expect(i18n).toContain("auditScope:'Εύρος επιθεώρησης'")
  })

  it('does not leave the inconsistent Πεδίο translation for "scope" anywhere', () => {
    for (const path of [
      'src/core/i18n/LanguageContext.jsx',
      'src/features/analysis/AnalysisPage.jsx',
      'src/features/management/BundleLibraryPanel.jsx',
      'src/core/help/helpExtras.js',
      'src/core/help/helpManual.js',
    ]) {
      expect(read(path)).not.toContain('Πεδίο')
    }
  })

  it('translates the bundle library scope column/field consistently', () => {
    const panel = read('src/features/management/BundleLibraryPanel.jsx')
    expect(panel).toContain("label:en?'Scope':'Εύρος'")
  })

  it('does not leave a hardcoded, untranslated "Scope" label in the Analysis report summary', () => {
    const analysisPage = read('src/features/analysis/AnalysisPage.jsx')
    expect(analysisPage).not.toContain('<span>Scope</span>')
    expect(analysisPage).toContain("tx('Εύρος','Scope')")
  })
})
