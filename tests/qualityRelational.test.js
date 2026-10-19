import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BLUE_CODE_INTERVENTIONS, EVENT_TYPES, INJURY_SUBCATEGORIES, OBSTETRIC_SUBCATEGORIES, SHARP_TOOLS, TRANSFER_TARGETS, detailBlocks, incidentDetailFacts, incidentDetailRows, incidentDetailsFromRow, keptDetails } from '../src/features/quality/incidentDetails'
import { analysisFromRow, analysisRows, checklistFromRows, checklistRows, diffChildRows, isUuid, progressFromRows, progressRow, sameAnalysis, subActionRows, subActionsFromRows } from '../src/features/quality/qualityRelations'
import { evaluationFromRow, nonconformityRows, scoreRows, supplierListsFromRow, certificationRows, evaluationRows } from '../src/features/quality/resources/supplierRelations'
import { evaluationScore } from '../src/features/quality/resources/resourceModel'
import { CAPA_TYPES } from '../src/features/quality/qualityVocabulary'
import { qualityCapas, qualityIncidents } from '../src/features/quality/qualityDemoData'

const migration = fs.readFileSync('supabase/migrations/20261116100000_quality_relational.sql', 'utf8')
const service = fs.readFileSync('src/features/quality/qualityService.js', 'utf8')
const resources = fs.readFileSync('src/features/quality/resources/resourceService.js', 'utf8')
const EMPLOYEE = '22222222-2222-4222-8222-222222222222'
const values = list => list.map(item => item.value)
const sqlList = pattern => [...migration.match(pattern)[1].matchAll(/'([a-z_]+)'/g)].map(match => match[1])

describe('incident event details', () => {
  it('records the blocks of the event type, and sharps after a sharp-object injury', () => {
    expect(detailBlocks({ eventType: 'death' })).toEqual([])
    expect(detailBlocks({ eventType: 'injury_fall_exposure' })).toEqual(['fall'])
    expect(detailBlocks({ eventType: 'injury_fall_exposure', fall: { injurySubcategory: 'sharp_object' } })).toEqual(['fall', 'sharp'])
    expect(detailBlocks({ eventType: 'blue_code' })).toEqual(['blueCode'])
    expect(detailBlocks({ eventType: 'obstetric' })).toEqual(['obstetric'])
  })

  it('writes one row per table: the blocks of the type with something filled in, nothing elsewhere', () => {
    const rows = incidentDetailRows({
      eventType: 'injury_fall_exposure',
      fall: { injurySubcategory: 'sharp_object', injuredPersonType: 'employee', injuredEmployeeId: EMPLOYEE, examinedByDoctor: false, location: ' Θάλαμος 3 ' },
      sharp: { tool: 'needle', bodySite: 'hands', bodySiteOther: 'left over', substance: 'Αίμα' },
      blueCode: { outcome: 'successful' },
      obstetric: { subcategory: 'preeclampsia' },
    })
    expect(rows.quality_incident_falls).toMatchObject({ injury_subcategory: 'sharp_object', injured_person_type: 'employee', injured_employee_id: EMPLOYEE, examined_by_doctor: false, location: 'Θάλαμος 3', fall_type: null })
    expect(rows.quality_incident_sharps).toMatchObject({ tool: 'needle', body_site: 'hands', body_site_other: null, substance: 'Αίμα' })
    expect(rows.quality_incident_blue_codes).toBeNull()
    expect(rows.quality_incident_obstetric).toBeNull()
    expect(incidentDetailRows({ eventType: 'obstetric', obstetric: { subcategory: '' } }).quality_incident_obstetric).toBeNull()
    expect(incidentDetailRows({ eventType: 'blue_code', blueCode: { interventions: ['cpr', 'magic'] } }).quality_incident_blue_codes.interventions).toEqual(['cpr'])
    // An employee only for an injured employee, and only one of the staff list.
    expect(incidentDetailRows({ eventType: 'injury_fall_exposure', fall: { injuredPersonType: 'patient', injuredEmployeeId: EMPLOYEE } }).quality_incident_falls.injured_employee_id).toBeNull()
    expect(incidentDetailRows({ eventType: 'injury_fall_exposure', fall: { injuredPersonType: 'employee', injuredEmployeeId: 'emp-demo-1' } }).quality_incident_falls.injured_employee_id).toBeNull()
  })

  it('reads the embedded rows back into the blocks, as an object or a one-row array', () => {
    const details = incidentDetailsFromRow({ fall: [{ fall_type: 'slip', examined_by_doctor: true, injured_employee_id: null }], blue_code: { interventions: ['cpr', 'oxygen'], gloves: false }, sharp: [], obstetric: null })
    expect(details.fall).toMatchObject({ fallType: 'slip', examinedByDoctor: true, injuredEmployeeId: '', floorCondition: '' })
    expect(details.blueCode).toMatchObject({ interventions: ['cpr', 'oxygen'], gloves: false, outcome: '' })
    expect(details.sharp).toBeNull()
    expect(details.obstetric).toBeNull()
  })

  it('keeps only the blocks of the type when saved, and shows what is filled in', () => {
    const kept = keptDetails({ eventType: 'obstetric', fall: { location: 'x' }, obstetric: { subcategory: 'haematoma' } })
    expect(kept.fall).toBeNull()
    expect(kept.obstetric).toEqual({ subcategory: 'haematoma' })
    expect(incidentDetailFacts(kept, 'en')).toEqual([['Event type', 'Obstetric event'], ['Obstetric subcategory', 'Haematoma']])
    const facts = incidentDetailFacts({ eventType: 'injury_fall_exposure', fall: { injuredPersonType: 'employee', injuredEmployeeId: 'e1', examinedByDoctor: false } }, 'el', [{ id: 'e1', firstName: 'Άννα', lastName: 'Μάρκου' }])
    expect(facts).toContainEqual(['Ποιος τραυματίστηκε', 'Εργαζόμενος · Μάρκου Άννα'])
    expect(facts).toContainEqual(['Εξετάστηκε από ιατρό', 'Όχι'])
  })

  it('gives the demo a fall and a needlestick with their details', () => {
    const fall = qualityIncidents.find(item => item.id === 'INC-251008-003')
    const needlestick = qualityIncidents.find(item => item.id === 'INC-260304-012')
    expect(detailBlocks(fall)).toEqual(['fall'])
    expect(detailBlocks(needlestick)).toEqual(['fall', 'sharp'])
    expect(incidentDetailRows(needlestick).quality_incident_sharps.tool).toBe('disposable_needle')
    expect(qualityCapas.find(item => item.id === 'CAPA-2606-008').progress).toHaveLength(2)
  })
})

describe('CAPA steps, root cause analysis and progress as rows', () => {
  it('writes the steps by position and reads them back in order', () => {
    const rows = subActionRows([{ id: 'sa-1', title: ' Εκπαίδευση ', owner: 'Α', dueDate: '2026-10-01', done: true, doneAt: '2026-10-02T10:00:00Z', doneBy: 'Β' }, { id: 'sa-2', title: '' }, { id: EMPLOYEE, title: 'Έλεγχος', owner: '', dueDate: '', done: false, doneAt: '2026-10-02T10:00:00Z', doneBy: 'Β' }])
    expect(rows).toHaveLength(2)
    expect(isUuid(rows[0].id)).toBe(true)
    expect(rows[1].id).toBe(EMPLOYEE)
    expect(rows.map(row => row.position)).toEqual([1, 2])
    expect(rows[0]).toMatchObject({ title: 'Εκπαίδευση', owner_label: 'Α', due_date: '2026-10-01', done: true, done_at: '2026-10-02T10:00:00Z', done_by_label: 'Β' })
    expect(rows[1]).toMatchObject({ owner_label: null, due_date: null, done: false, done_at: null, done_by_label: null })
    const back = subActionsFromRows([...rows].reverse())
    expect(back.map(step => step.title)).toEqual(['Εκπαίδευση', 'Έλεγχος'])
    expect(back[0]).toMatchObject({ owner: 'Α', dueDate: '2026-10-01', done: true, doneBy: 'Β' })
  })

  it('keeps the 5 Whys by position and the Ishikawa causes by category', () => {
    const analysis = { problem: ' Πρόβλημα ', whys: ['α', '', 'γ', '', ''], causes: { people: ['p1', ' '], equipment: ['e1', 'e2'] }, rootCause: 'ρίζα', updatedBy: 'Ε. Ζ.' }
    const rows = analysisRows(analysis)
    expect(rows.analysis).toEqual({ problem_statement: 'Πρόβλημα', root_cause: 'ρίζα', updated_by_label: 'Ε. Ζ.' })
    expect(rows.whys).toEqual([{ position: 1, answer: 'α' }, { position: 3, answer: 'γ' }])
    expect(rows.factors).toEqual([{ category: 'people', position: 1, description: 'p1' }, { category: 'equipment', position: 1, description: 'e1' }, { category: 'equipment', position: 2, description: 'e2' }])
    const back = analysisFromRow({ ...rows.analysis, updated_at: '2026-10-01T09:30:00+00:00', whys: rows.whys, factors: [...rows.factors].reverse() })
    expect(back.whys).toEqual(['α', '', 'γ', '', ''])
    expect(back.causes.equipment).toEqual(['e1', 'e2'])
    expect(back.causes.methods).toEqual([])
    expect(back).toMatchObject({ problem: 'Πρόβλημα', rootCause: 'ρίζα', updatedAt: '2026-10-01T09:30:00+00:00', updatedBy: 'Ε. Ζ.' })
    expect(analysisRows({ problem: ' ', whys: [] })).toBeNull()
    expect(analysisFromRow([])).toBeNull()
  })

  it('rewrites the analysis only when what it says changed', () => {
    const analysis = { problem: 'Π', whys: ['α'], causes: { people: ['p'] }, rootCause: '' }
    expect(sameAnalysis(analysis, { ...analysis, updatedBy: 'someone else', updatedAt: 'now' })).toBe(true)
    expect(sameAnalysis(analysis, { ...analysis, whys: ['β'] })).toBe(false)
    expect(sameAnalysis(null, { problem: '', whys: ['', ''] })).toBe(true)
  })

  it('keeps progress notes with a date, newest first', () => {
    expect(progressRow({ note: ' ' })).toBeNull()
    const row = progressRow({ date: '2026-10-01', note: ' Έγινε ', author: 'Α' })
    expect(row).toMatchObject({ entry_date: '2026-10-01', note: 'Έγινε', author_label: 'Α' })
    expect(progressFromRows([{ id: 'a', entry_date: '2026-09-01', note: 'πρώτη' }, { id: 'b', entry_date: '2026-10-01', note: 'δεύτερη' }]).map(entry => entry.note)).toEqual(['δεύτερη', 'πρώτη'])
  })
})

describe('audit checklist as rows', () => {
  it('stores each item by position, its answer, note and the finding of a «No»', () => {
    const findingId = '33333333-3333-4333-8333-333333333333'
    const rows = checklistRows([{ id: 'item-1', item: 'Σήμανση', itemEn: 'Sign', required: true, answer: 'yes', note: '' }, { id: 'item-2', item: 'ΜΑΠ', itemEn: 'ΜΑΠ', required: false, answer: 'no', note: ' λείπουν ', findingId: 'FND-1' }, { item: ' ' }], new Map([['FND-1', findingId]]))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ position: 1, item: 'Σήμανση', item_en: 'Sign', required: true, answer: 'yes', note: null, finding_id: null })
    expect(rows[1]).toMatchObject({ position: 2, item_en: null, required: false, answer: 'no', note: 'λείπουν', finding_id: findingId })
    const back = checklistFromRows([{ ...rows[1], finding: { code: 'FND-1' } }, rows[0]])
    expect(back.map(row => row.item)).toEqual(['Σήμανση', 'ΜΑΠ'])
    expect(back[1]).toMatchObject({ itemEn: 'ΜΑΠ', findingId: 'FND-1', answer: 'no' })
    expect(back[0]).not.toHaveProperty('findingId')
  })
})

describe('child row changes', () => {
  it('writes the new and the changed rows and removes the missing ones', () => {
    const existing = [{ id: 'a', weight: '1.00', score: 4, done_at: '2026-10-02T10:00:00+00:00' }, { id: 'b', weight: '1.00', score: 3, done_at: null }, { id: 'c', weight: '2.00', score: 5, done_at: null }]
    const wanted = [{ id: 'a', weight: 1, score: 4, done_at: '2026-10-02T10:00:00.000Z' }, { id: 'b', weight: 1, score: 5, done_at: null }, { id: 'd', weight: 1, score: 2, done_at: null }]
    const { upsert, remove } = diffChildRows(existing, wanted, ['weight', 'score', 'done_at'])
    expect(upsert.map(row => row.id)).toEqual(['b', 'd'])
    expect(remove).toEqual(['c'])
  })
})

describe('supplier lists as rows', () => {
  it('keeps one score row per criterion scored, with its weight', () => {
    const stored = [{ id: 'kept-id', criterion: 'quality' }]
    const rows = scoreRows({ scores: { quality: 5, delivery: '', specs: 4, documents: 6, support: 3, price: 2 }, weights: { specs: 2 } }, stored)
    expect(rows.map(row => row.criterion)).toEqual(['quality', 'specs', 'support', 'price'])
    expect(rows[0].id).toBe('kept-id')
    expect(rows[1]).toMatchObject({ weight: 2, score: 4 })
    const evaluation = evaluationFromRow({ id: 'e', evaluated_on: '2026-01-10', evaluator: null, notes: null, scores: rows.map(row => ({ ...row, weight: String(row.weight) })) })
    expect(evaluation.scores).toMatchObject({ quality: 5, delivery: '', specs: 4, support: 3, price: 2 })
    expect(evaluation.weights).toEqual({ specs: 2 })
    expect(evaluationScore(evaluation.scores, evaluation.weights)).toBe(Math.round((5 + 8 + 3 + 2) / (5 * 5) * 100))
    expect(evaluationScore({ quality: 4, specs: 2 })).toBe(60)
  })

  it('maps certifications and nonconformities to their columns and back', () => {
    const certs = certificationRows([{ id: 'c1', type: 'ISO 9001', number: '', issuer: 'Φορέας', expiresOn: '' }, { id: 'c2', type: ' ' }])
    expect(certs).toHaveLength(1)
    expect(certs[0]).toMatchObject({ certificate_type: 'ISO 9001', certificate_number: null, issuer: 'Φορέας', expires_on: null })
    const ncs = nonconformityRows([{ id: 'n1', date: '2026-05-01', description: 'Καθυστέρηση', severity: 'minor', status: 'open', capaCode: '', closedOn: '2026-06-01' }])
    expect(ncs[0]).toMatchObject({ occurred_on: '2026-05-01', status: 'open', closed_on: null, capa_code: null })
    const evaluations = evaluationRows([{ id: 'e1', evaluatedOn: '2026-01-10', evaluator: ' ΥΠ ', notes: '' }, { id: 'e2', evaluatedOn: '' }])
    expect(evaluations).toHaveLength(1)
    expect(evaluations[0]).toMatchObject({ evaluated_on: '2026-01-10', evaluator: 'ΥΠ', notes: null })
    const lists = supplierListsFromRow({ certifications: certs.map(row => ({ ...row, created_at: '2026-01-01' })), nonconformities: ncs, evaluations: [] })
    expect(lists.certifications[0]).toMatchObject({ type: 'ISO 9001', number: '', issuer: 'Φορέας', expiresOn: '' })
    expect(lists.nonconformities[0]).toMatchObject({ date: '2026-05-01', description: 'Καθυστέρηση', closedOn: '' })
  })
})

describe('20261116100000_quality_relational.sql', () => {
  const tables = [...migration.matchAll(/create table if not exists public\.(\w+)/g)].map(match => match[1])

  it('creates every detail table with its organization, audit fields, RLS, indexes and no anon', () => {
    expect(tables).toEqual(['quality_incident_falls', 'quality_incident_sharps', 'quality_incident_blue_codes', 'quality_incident_obstetric', 'quality_capa_sub_actions', 'quality_capa_root_cause_analyses', 'quality_capa_root_cause_whys', 'quality_capa_root_cause_factors', 'quality_capa_progress', 'quality_audit_checklist_items', 'quality_supplier_certifications', 'quality_supplier_evaluations', 'quality_supplier_evaluation_scores', 'quality_supplier_nonconformities'])
    const triggerList = migration.match(/foreach t in array array\['quality_incident_falls'[^\]]*'quality_capa_sub_actions'[^\]]*\]/)[0]
    for (const table of tables) {
      const body = migration.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`))[1]
      expect(body).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
      for (const column of ['created_by uuid default auth.uid()', 'created_at timestamptz not null default now()', 'updated_by uuid', 'updated_at timestamptz not null default now()']) expect(body).toContain(column)
      expect(body).toMatch(/foreign key \(\w+, organization_id\) references public\.quality_\w+\(\w+, organization_id\) on delete cascade/)
      expect(migration).toMatch(new RegExp(`create index if not exists ${table}_org_idx on public\\.${table} \\(organization_id`))
      expect(migration).toContain(`'${table}'`)
      expect(triggerList).toContain(`'${table}'`)
    }
    expect(migration).toContain("execute format('revoke all on public.%I from anon', t)")
    expect(migration).toContain("execute format('alter table public.%I enable row level security', t)")
    expect(migration).toContain('execute function public.set_repository_audit_fields()')
    expect(migration).toContain('current_user_quality_read_orgs()')
    expect(migration).toContain('current_user_quality_manage_orgs()')
    // Read as the parent: its own policy applies inside exists().
    expect(migration).toContain('or exists (select 1 from public.quality_incidents p where p.id = incident_id)')
    expect(migration).toContain("' or exists (select 1 from public.%I p where p.id = %I)', parent, parent_key")
  })

  it('keeps the closed lists of the app and the database the same', () => {
    expect(sqlList(/quality_incidents_event_type_check check \(event_type is null or event_type in\s*\(([^)]*)\)/)).toEqual(values(EVENT_TYPES))
    expect(sqlList(/subcategory text not null check \(subcategory in \(([^)]*)\)/)).toEqual(values(OBSTETRIC_SUBCATEGORIES))
    expect(sqlList(/check \(interventions <@ array\[([^\]]*)\]/)).toEqual(values(BLUE_CODE_INTERVENTIONS))
    expect(sqlList(/injury_subcategory text check \(injury_subcategory in \(([^)]*)\)/)).toEqual(values(INJURY_SUBCATEGORIES))
    expect(sqlList(/tool text check \(tool in \(([^)]*)\)/)).toEqual(values(SHARP_TOOLS))
    expect(sqlList(/transfer_to text check \(transfer_to in \(([^)]*)\)/)).toEqual(values(TRANSFER_TARGETS))
    expect(sqlList(/quality_capa_actions_action_type_check check \(action_type in\s*\(([^)]*)\)/)).toEqual(values(CAPA_TYPES))
  })

  it('copies the jsonb field by field, raises on any difference, and drops the columns only after', () => {
    for (const what of ['CAPA steps', 'CAPA analyses', 'CAPA 5 Whys', 'CAPA Ishikawa causes', 'Audit checklists', 'Supplier certifications', 'Supplier evaluations', 'Supplier evaluation scores', 'Supplier nonconformities']) expect(migration).toContain(`raise exception '${what}:`)
    const copy = migration.indexOf('do $copy$')
    for (const drop of ['drop column if exists sub_actions', 'drop column if exists root_cause_analysis', 'drop column if exists checklist', 'drop column if exists certifications', 'drop column if exists evaluations', 'drop column if exists nonconformities']) expect(migration.indexOf(drop)).toBeGreaterThan(copy)
    expect(migration).not.toMatch(/drop column if exists history/)
    // The audit trigger comes after the copy, which keeps the original times.
    expect(migration.indexOf('trg_')).toBeGreaterThan(copy)
  })

  it('rewrites the demo seed so it no longer writes the dropped columns', () => {
    const demo = migration.slice(migration.indexOf('create or replace function private.demo_seed_quality_audits'))
    expect(demo).toContain('create or replace function private.demo_seed_quality_enrich')
    expect(demo).not.toMatch(/sub_actions|root_cause_analysis/)
    expect(demo.match(/perform private\.quality_capa_import_json/g)).toHaveLength(2)
  })
})

describe('the services write the tables, not the jsonb', () => {
  it('reads the details with the record and writes no jsonb field', () => {
    expect(service).toContain('quality_capa_sub_actions(*)')
    expect(service).toContain('quality_capa_progress(*)')
    expect(service).not.toMatch(/sub_actions:(draft|record|Array)/)
    expect(service).not.toMatch(/root_cause_analysis:/)
    expect(service).not.toMatch(/checklist:Array\.isArray|checklist:draft\.checklist\|\|\[\],checklist_source/)
    expect(service).toContain("event_type:record.eventType||null")
    expect(resources).toContain('SUPPLIER_SELECT')
    expect(resources).not.toMatch(/certifications: supplier\.|evaluations: supplier\.|nonconformities: supplier\./)
  })
})
