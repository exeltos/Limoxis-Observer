import { describe, expect, it } from 'vitest'
import { translate } from '../src/core/i18n/LanguageContext'
import { filterRegister } from '../src/features/quality/qualityRegister'
import { filterDeviations } from '../src/features/quality/QualityReportRegister'
import { filterActions, filterAudits } from '../src/features/quality/QualityLists'
import { equipmentStateLabel, filterEquipment, filterSuppliers, supplierCategoryLabel } from '../src/features/quality/resources/resourceModel'
import { filterSurveys } from '../src/features/quality/surveys/SurveysPanel'
import { audienceLabel } from '../src/features/quality/surveys/surveyModel'
import { filterSelf, selfStatusLabel } from '../src/features/quality/selfAssessment/selfAssessmentModel'
import { matches as kitchenMatches } from '../src/features/kitchen/KitchenShared'
import { matchesQuery } from '../src/features/library/libraryModel'
import { readSource } from './helpers/readSource'

// The owner, 19/11/2026: «οι αναζητήσεις να ψάχνουν τα πάντα» — every list's search finds a row by anything
// the row shows (department, date, status in the current language, organism, owner…), without accents or capitals,
// and every typed word must match.
describe('search everywhere: the quality lists', () => {
  it('incidents are found by department, in either language, and by the words the row shows', () => {
    const rows = [
      { id: 'A', type: 'report', kind: 'incident', code: 'INC-1', title: 'Πτώση', titleEn: 'Fall', owner: '', department: 'Παθολογική', departmentEn: 'Internal medicine', stage: 'investigating', date: '2026-03-01' },
      { id: 'B', type: 'report', kind: 'incident', code: 'INC-2', title: 'Λάθος φάρμακο', titleEn: 'Wrong drug', owner: '', department: 'ΜΕΘ', departmentEn: 'ICU', stage: 'closed', date: '2026-03-02' },
    ] as never[]
    expect(filterRegister(rows, { query: 'παθολογικη' }).map(row => row.id)).toEqual(['A'])
    expect(filterRegister(rows, { query: 'icu' }).map(row => row.id)).toEqual(['B'])
    // The screen passes the labels it shows (stage, kind, date…).
    const labels = (row: { stage?: string }) => [row.stage === 'closed' ? 'Κλειστή' : 'Σε διερεύνηση']
    expect(filterRegister(rows, { query: 'κλειστη', labels }).map(row => row.id)).toEqual(['B'])
    expect(filterRegister(rows, { query: 'μεθ κλειστη', labels }).map(row => row.id)).toEqual(['B'])
    expect(filterRegister(rows, { query: 'μεθ διερευνηση', labels })).toEqual([])
  })

  it('deviations are found by their status label and their priority', () => {
    const row = (code: string, extra = {}) => ({ key: code, type: 'finding', code, title: code, titleEn: code, source: 'manual', status: 'closed', severity: 'medium', department: 'ΜΕΘ', departmentEn: 'ICU', date: '2026-03-01', hasCapa: true, deviationKind: '', causeCategories: [], recurring: null, item: {}, ...extra })
    const ALL = { query: '', scope: 'registry', source: 'all', department: 'all', priority: 'all', status: 'all', deviationKind: 'all', cause: 'all', recurring: 'all', dateFrom: '', dateTo: '', quick: null }
    const rows = [row('FND-1'), row('FND-2', { status: 'open', severity: 'high' })] as never[]
    expect(filterDeviations(rows, { ...ALL, query: translate('open', 'el') }, 'el').map(r => r.code)).toEqual(['FND-2'])
    expect(filterDeviations(rows, { ...ALL, query: translate('high', 'en') }, 'en').map(r => r.code)).toEqual(['FND-2'])
    expect(filterDeviations(rows, { ...ALL, query: '1/3/2026' }, 'el')).toHaveLength(2)
  })

  it('actions and audits are found by department, status and kind', () => {
    const base = { query: '', kind: 'all', status: 'all', department: 'all', source: 'all', cycle: 'all', quick: null, dateFrom: '', dateTo: '' }
    const actions = [
      { id: 'C1', kind: 'capa', status: 'open', title: 'Εκπαίδευση', titleEn: 'Training', department: 'Χειρουργική', departmentEn: 'Surgery', actionType: 'corrective', sourceKind: 'manual' },
      { id: 'C2', kind: 'capa', status: 'closed', title: 'Νέα διαδικασία', titleEn: 'New procedure', department: 'ΜΕΘ', departmentEn: 'ICU', actionType: 'preventive', sourceKind: 'manual' },
    ] as never[]
    expect(filterActions(actions, { ...base, query: 'χειρουργικη' } as never, false).map(row => row.id)).toEqual(['C1'])
    expect(filterActions(actions, { ...base, query: translate('closed', 'en') } as never, true).map(row => row.id)).toEqual(['C2'])
    const audits = [{ id: 'A1', title: 'Υγιεινή χεριών', titleEn: 'Hand hygiene', department: 'ΜΕΘ', departmentEn: 'ICU', status: 'planned', auditType: 'internal', plannedDate: '2026-05-10' }] as never[]
    const auditBase = { query: '', status: 'all', type: 'all', department: 'all', cycle: 'all', quick: null }
    expect(filterAudits(audits, { ...auditBase, query: 'μεθ 10/5/2026' } as never, false)).toHaveLength(1)
    expect(filterAudits(audits, { ...auditBase, query: 'χειρουργικη' } as never, false)).toHaveLength(0)
  })

  it('equipment, suppliers, surveys and self-assessments by the labels they show', () => {
    const equipment = [
      { id: 'e1', code: 'EQ-1', name: 'Απινιδωτής', department: 'ΜΕΘ', state: 'out_of_service', due: 'none', criticality: 'high' },
      { id: 'e2', code: 'EQ-2', name: 'Αντλία', department: 'Παθολογική', state: 'in_service', due: 'none', criticality: 'low' },
    ] as never[]
    const all = { query: '', department: 'all', state: 'all', due: 'all', criticality: 'all', quick: null }
    expect(filterEquipment(equipment, { ...all, query: equipmentStateLabel('out_of_service', 'el') }, 'el').map(row => row.id)).toEqual(['e1'])
    expect(filterEquipment(equipment, { ...all, query: 'παθολογικη αντλια' }, 'el').map(row => row.id)).toEqual(['e2'])
    const suppliers = [{ id: 's1', code: 'SUP-1', name: 'Τροφοδοσία ΑΕ', category: 'food', status: 'active', approval: 'approved', criticality: 'medium' }] as never[]
    const supplierAll = { query: '', category: 'all', approval: 'all', criticality: 'all', status: 'all', quick: null }
    expect(filterSuppliers(suppliers, { ...supplierAll, query: supplierCategoryLabel('food', 'el') }, 'el')).toHaveLength(1)
    const surveys = [{ id: '1', code: 'SRV-1', title: 'Ικανοποίηση ασθενών', audience: 'patients', status: 'open', questions: [] }] as never[]
    expect(filterSurveys(surveys, { query: audienceLabel('patients', 'el'), audience: 'all', status: 'all', quick: null } as never, 'el')).toHaveLength(1)
    const self = [{ id: 'x', title: 'Αυτοαξιολόγηση', departmentName: 'ΜΕΘ', status: 'released', dueOn: '2099-01-01' }] as never[]
    expect(filterSelf(self, selfStatusLabel('released', 'el'), 'el')).toHaveLength(1)
  })
})

describe('search everywhere: the other lists', () => {
  it('kitchen and library need every typed word, without accents', () => {
    expect(kitchenMatches('γαλα 12/11', 'Γάλα', '12/11/2026')).toBe(true)
    expect(kitchenMatches('γαλα ψωμι', 'Γάλα', '12/11/2026')).toBe(false)
    const item = { name: 'Οδηγία υγιεινής χεριών', organisation: 'ΕΟΔΥ', tags: [] } as never
    expect(matchesQuery(item, 'εοδυ χερια', 'el')).toBe(false)
    expect(matchesQuery(item, 'εοδυ χεριων', 'el')).toBe(true)
  })

  it('surveillance searches the department, the date, the status and the resistance', () => {
    const page = readSource('src/features/surveillance/SurveillanceCanonicalPage.tsx')
    expect(page).toContain('matchesSearch(query, [x.patient, x.patientEn, x.patientId, x.id, x.department, x.departmentEn, formatDay(x.startedAt, language), latestOrganism(x), latestResistance(x), t(x.status as string)])')
    expect(page).toContain('employeeScreeningLabel(id, language)')
    expect(page).toContain('environmentalStatusDisplay(x, t).label')
  })

  it('employees by profession, laboratory by everything a sample row shows, training by department', () => {
    expect(readSource('src/features/employees/EmployeesPage.tsx')).toContain('x.profession,x.professionEn,x.position,x.positionEn')
    const lab = readSource('src/features/laboratory/LaboratoryWorkspace.tsx')
    expect(lab).toContain('matchesSearch(query, labSampleSearchParts(sample, t, language))')
    expect(lab).toContain('labSampleStatus(sample, language).text')
    expect(readSource('src/features/training/TrainingProductionPage.tsx')).toContain('programDepartments.get(x.id),periodText(x.startDate,x.dueDate)')
  })
})
