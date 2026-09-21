import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const i18n = fs.readFileSync('src/core/i18n/LanguageContext.jsx', 'utf8')
const librariesPanel = fs.readFileSync('src/features/management/LibrariesPanel.jsx', 'utf8')
const environmentalStandardsPanel = fs.readFileSync('src/features/management/EnvironmentalStandardsPanel.jsx', 'utf8')

describe('platform terminology and language polish', () => {
  it('unifies "admission" as Νοσηλεία instead of the import-flavored Εισαγωγή', () => {
    expect(i18n).toContain("admission:'Νοσηλεία', admissions:'Νοσηλείες'")
    expect(i18n).not.toContain("admission:'Εισαγωγή'")
  })

  it('routes the system-library badge through translation instead of hardcoded English', () => {
    expect(librariesPanel).toContain("t('librariesPanel.systemOwnerBadge')")
    expect(librariesPanel).toContain("t('librariesPanel.systemReadOnlyBadge')")
    expect(librariesPanel).not.toContain("'System · Owner'")
    expect(librariesPanel).not.toContain("'System · Read only'")
    expect(environmentalStandardsPanel).toContain("t('librariesPanel.systemOwnerBadge')")
    expect(environmentalStandardsPanel).toContain("t('librariesPanel.systemReadOnlyBadge')")
  })

  it('removes leaked English technical jargon from Greek-facing dictionary strings', () => {
    expect(i18n).not.toContain('ως hospital override')
    expect(i18n).not.toContain('με core baseline')
    expect(i18n).not.toContain('Το core baseline')
    expect(i18n).not.toContain("departmentScope:'Scope τμήματος'")
    expect(i18n).not.toContain("capabilityBasedAccess:'Πρόσβαση βάσει capabilities'")
    expect(i18n).not.toContain('Οι custom ρόλοι')
  })
})
