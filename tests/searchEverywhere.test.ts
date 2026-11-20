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
import { filterResponses } from '../src/features/quality/surveys/surveyModel'
import { filterRegister as filterLegislation, NO_FILTERS as NO_LEGISLATION_FILTERS } from '../src/features/legislation/legislationModel'
import { filterCandidates } from '../src/features/interviews/interviewsModel'
import { splitNotifiableRows } from '../src/features/management/NotifiableDiseasesTable'
import { preventionSearchParts } from '../src/features/prevention/PreventionTables'
import { matchesSearch } from '../src/core/i18n/searchMatch'
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

describe('search everywhere: the remaining lists', () => {
  it('survey responses by every answer (in words), the department, the channel and the date', () => {
    const survey = { questions: [
      { id: 'q1', type: 'yesno', label: 'Θα μας προτείνατε;', labelEn: 'Would you recommend us?' },
      { id: 'q2', type: 'single', label: 'Φαγητό', options: [{ value: 'hot', label: 'Ζεστό', labelEn: 'Hot' }, { value: 'cold', label: 'Κρύο', labelEn: 'Cold' }] },
      { id: 'q3', type: 'text', label: 'Σχόλιο' },
    ] } as never
    const responses = [
      { id: 'r1', departmentId: 'd1', department: 'Παθολογική', departmentEn: 'Internal medicine', channel: 'paper', submittedAt: '2026-10-05T10:00:00Z', answers: { q1: true, q2: 'cold', q3: 'Καθαρό δωμάτιο' } },
      { id: 'r2', departmentId: 'd2', department: 'ΜΕΘ', departmentEn: 'ICU', channel: 'link', submittedAt: '2026-10-06T10:00:00Z', answers: { q1: false, q2: 'hot' } },
    ] as never[]
    const ids = (query: string, language = 'el') => filterResponses(responses, { query }, survey, language).map(row => row.id)
    expect(ids('κρυο')).toEqual(['r1'])
    expect(ids('cold', 'en')).toEqual(['r1'])
    expect(ids('εντυπο καθαρο')).toEqual(['r1'])
    expect(ids('icu')).toEqual(['r2'])
    expect(ids('6/10/2026')).toEqual(['r2'])
    // Without the questionnaire (an earlier year's answers) the free text still counts.
    expect(filterResponses(responses, { query: 'καθαρο' }).map(row => row.id)).toEqual(['r1'])
  })

  it('legislation by kind, state and reference; candidates by status; notifiable diseases by deadline', () => {
    const entry = (code: string, kind: string, state: string) => ({ text: { id: code, code, title: code, kind, status: 'in_force', topics: [], version: 1, reference: 'ΦΕΚ Β 100/2020' }, row: null, history: [], state, summary: { total: 0, compliant: 0, partial: 0, non_compliant: 0, not_applicable: 0, unassessed: 0, percent: null }, reviewLate: false, changed: new Set() })
    const entries = [entry('LEG-1', 'law', 'new'), entry('LEG-2', 'circular', 'compliant')] as never[]
    expect(filterLegislation(entries, { ...NO_LEGISLATION_FILTERS, query: 'εγκυκλιος' }, 'el').map(row => row.text.code)).toEqual(['LEG-2'])
    expect(filterLegislation(entries, { ...NO_LEGISLATION_FILTERS, query: 'needs a decision' }, 'en').map(row => row.text.code)).toEqual(['LEG-1'])
    expect(filterLegislation(entries, { ...NO_LEGISLATION_FILTERS, query: 'φεκ 100' }, 'el')).toHaveLength(2)
    const candidates = [
      { id: '1', code: 'ΥΠ-1', fullName: 'Μαρία Παπά', status: 'offer', requestedPosition: 'Μάγειρας', appliedOn: '2026-03-05' },
      { id: '2', code: 'ΥΠ-2', fullName: 'Νίκος Ιωάννου', status: 'new', requestedPosition: 'Μάγειρας', appliedOn: '2026-03-06' },
    ] as never[]
    expect(filterCandidates(candidates, { query: 'προταση μαγειρας' }).map(row => row.code)).toEqual(['ΥΠ-1'])
    expect(filterCandidates(candidates, { query: '6/3/2026' }).map(row => row.code)).toEqual(['ΥΠ-2'])
    expect(filterCandidates(candidates, { query: 'new application', language: 'en' }).map(row => row.code)).toEqual(['ΥΠ-2'])
    const t = (key: string) => (key === 'librariesPanel.eodyFilterImmediate' ? 'Άμεσα' : key)
    const legacy = [['Παλιό νόσημα', 'Old disease', { code: 'ND-OLD' }]] as never[]
    expect(splitNotifiableRows(legacy, { query: 'παλιο ND-OLD', t }).legacy).toHaveLength(1)
  })

  it('prevention rows by what each tab shows, not by hidden fields', () => {
    const t = (key: string) => ({ nursing: 'Νοσηλευτικό προσωπικό', complete: 'Ολοκληρωμένος' } as Record<string, string>)[key] || key
    const hand = { id: 'h1', date: '2026-04-02', departmentEl: 'Χειρουργική', departmentEn: 'Surgery', profession: 'nursing', observations: 10, compliant: 8, rate: 80, observer: 'Ελένη', internalNote: 'κρυφό' } as never
    expect(matchesSearch('νοσηλευτικο χειρουργικη 02/04/2026', preventionSearchParts('handHygiene', hand, { t, language: 'el' }))).toBe(true)
    expect(matchesSearch('surgery', preventionSearchParts('handHygiene', hand, { t, language: 'el' }))).toBe(true)
    expect(matchesSearch('κρυφο', preventionSearchParts('handHygiene', hand, { t, language: 'el' }))).toBe(false)
    const vaccination = { id: 'v1', employeeId: 'E1', vaccine: 'Γρίπη', status: 'complete', date: '2026-10-01' } as never
    expect(matchesSearch('γριπη ολοκληρωμενος παπαδοπουλος', preventionSearchParts('vaccinations', vaccination, { t, language: 'el', employee: { id: 'E1', lastName: 'Παπαδόπουλος', firstName: 'Γιώργος' } as never }))).toBe(true)
  })

  it('platform, management, controls and training lists search what the row shows', () => {
    expect(readSource('src/features/platform/PlatformAuditSecurityView.tsx')).toContain('eventLabel(row.eventType,en),entityLabel(row.entityType,en)')
    expect(readSource('src/features/platform/PlatformHealthView.tsx')).toContain('localModule(row.module,language),localRoute(row.route,language)')
    expect(readSource('src/features/platform/PlatformLoginSessionsView.tsx')).toContain('sessionStatus(row,en).label')
    expect(readSource('src/features/platform/HospitalDiagnosticsPanel.tsx')).toContain('localMessage(row.message,language)')
    expect(readSource('src/features/management/LibrariesPanel.tsx')).toContain('matchesSearch(query,librarySearchParts(x))')
    expect(readSource('src/features/management/EnvironmentalStandardsPanel.tsx')).toContain('sampleTypeLabel(x.subjectType,t),environmentalMethodLabel(x.sourceCode,t)')
    expect(readSource('src/features/management/ManagementRolesPanel.tsx')).toContain('matchesSearch(roleQuery,[role.name,roleAreas(role.capabilities,en)')
    expect(readSource('src/features/management/LiraKnowledgePanel.tsx')).toContain('ingestionLabel(x.ingestion_status,en)])')
    expect(readSource('src/features/controls/ControlExpiryPanel.tsx')).toContain('statusText(item,language),rowFindingText(item.row,language)')
    expect(readSource('src/features/analysis/TrainingAnalyticsReport.tsx')).toContain('matchesSearch(employeeQuery,[name,department,profession')
  })
})
