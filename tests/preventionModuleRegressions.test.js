import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// Prevention module review, following the pattern of past module reviews.
describe('the bulk vaccination "saved" toast interpolates the count in Greek too', () => {
  it('no longer calls t() with a second (unsupported) interpolation argument', () => {
    const page = fs.readFileSync('src/features/prevention/PreventionPage.jsx', 'utf8')
    expect(page).not.toContain("t('vaccinationsSaved',{count:selected.length})")
    expect(page).toContain("'copy.preventionCopy.vaccinationSavedMany').replace('{count}',selected.length)")
    expect(fs.readFileSync('src/core/i18n/LanguageContext.jsx','utf8')).toContain("vaccinationSavedMany:'Αποθηκεύτηκαν {count} εμβολιασμοί.'")
  })
})

describe('the vaccination record viewer resolves the employee even when they are inactive or resigned', () => {
  it('the registry passes the already-resolved employee (from the unfiltered employeeMap) into the editor instead of re-deriving it from the active-only picker list', () => {
    const page = fs.readFileSync('src/features/prevention/PreventionPage.jsx', 'utf8')
    expect(page).toContain('selectedEmployee:employeeMap[row.employeeId]||null')
  })
  it('the editor prefers the pre-resolved employee over deriving one from the (possibly filtered) employees prop', () => {
    const editor = fs.readFileSync('src/features/prevention/StaffVaccinationEditor.jsx', 'utf8')
    expect(editor).toContain('const selectedEmployee=value.selectedEmployee||employees.find(')
  })
})

describe('the vaccination record Edit/Delete menu is gated behind the manage capability, not just RLS', () => {
  it('PreventionPage passes canManage from the same capability check that already gates record creation', () => {
    const page = fs.readFileSync('src/features/prevention/PreventionPage.jsx', 'utf8')
    expect(page).toContain('canManage={canCreateRecord}')
  })
  it('StaffVaccinationEditor only renders the actions menu when canManage is true', () => {
    const editor = fs.readFileSync('src/features/prevention/StaffVaccinationEditor.jsx', 'utf8')
    expect(editor).toContain('{canManage&&<div className="vaccination-record-actions">')
  })
})

describe('demo hand-hygiene seed data uses the canonical WHO moment ids and profession labels', () => {
  const demo = fs.readFileSync('src/features/prevention/preventionDemoData.js', 'utf8')
  it('no longer uses the obsolete before_patient/after_patient/... moment id scheme', () => {
    for (const obsolete of ['before_patient', 'after_patient', 'before_aseptic', 'after_body_fluid', 'after_surroundings']) {
      expect(demo).not.toContain(`'${obsolete}'`)
    }
  })
  it('uses the canonical moment1..5 ids that WhoHandHygieneEditor and PreventionRecordPage actually resolve', () => {
    expect(demo).toContain("moments:['moment1']")
    expect(demo).toContain("moments:['moment4']")
  })
  it('uses professionalCategory values that exist in WHO_PROFESSIONS instead of a Greek adjective that has no English translation', () => {
    expect(demo).not.toContain("professionalCategory:'Νοσηλευτικό'")
    expect(demo).not.toContain("professionalCategory:'Ιατρικό'")
    expect(demo).toContain("professionalCategory:'Νοσηλευτής / Νοσηλεύτρια'")
    expect(demo).toContain("professionalCategory:'Ιατρός'")
  })
})

describe('demo antiseptic seed data uses a valid ANTISEPTIC_METHODS id', () => {
  it('no longer uses the invalid "manual" method id', () => {
    const demo = fs.readFileSync('src/features/prevention/preventionDemoData.js', 'utf8')
    expect(demo).not.toContain("method:'manual'")
    expect(demo).toContain("method:'direct_measurement'")
  })
})

describe('the dead, superseded AntisepticEntryModal component was removed', () => {
  it('the file now only exports the still-used helpers, not the unused dialog component', () => {
    const file = fs.readFileSync('src/features/prevention/AntisepticEntryModal.jsx', 'utf8')
    expect(file).not.toContain('export function AntisepticEntryModal(')
    expect(file).toContain('export const ANTISEPTIC_METHODS=')
    expect(file).toContain('export function isAbhrProduct(')
    expect(file).toContain('export function antisepticMethodLabel(')
  })
})
