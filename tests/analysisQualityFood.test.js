import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildQualityFoodMetrics, qualityFoodIndicatorMetrics, qualityFoodSection, assessmentInForce } from '../src/features/analysis/analysisQualityFood'
import { buildSectionModel, collectDemoQualityFood } from '../src/features/analysis/analysisDomains'
import { mergeDomainMetrics } from '../src/features/analysis/analysisDomainMerge'
import { TABS, TAB_MODULES, analysisGroups } from '../src/features/analysis/analysisPageModel'
import { indicatorDefinitionRows } from '../src/features/indicators/indicatorDemoData'
import { collectIndicatorMetrics } from '../src/features/indicators/indicatorEngine'
import { satisfactionCounts, surveySummary } from '../src/features/quality/surveys/surveyModel'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage())
  configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
})

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const tx = el => el
const range = { from: '2026-01-01', to: '2026-12-31' }
const today = '2026-10-19'

const sources = {
  audits: [
    { status: 'completed', completedDate: '2026-03-10', standard: 'iso9001', checklist: [{ answer: 'yes' }, { answer: 'yes' }, { answer: 'partial' }, { answer: 'no' }, { answer: 'na' }, {}] },
    { status: 'completed', completedDate: '2026-05-01', standard: 'haccp', checklist: [{ answer: 'yes' }, { answer: 'yes' }] },
    { status: 'completed', completedDate: '2025-11-01', standard: 'jci', checklist: [{ answer: 'no' }] },
    { status: 'completed', completedDate: '2026-06-01', standard: 'jci', lifecycleStatus: 'voided', checklist: [{ answer: 'no' }] },
    { status: 'planned', plannedDate: '2026-11-20', standard: 'iso15189', checklist: [] },
  ],
  findings: [
    { source: 'audit', status: 'open', findingClass: 'major' },
    { source: 'audit', status: 'inProgress', findingClass: 'minor' },
    { source: 'audit', status: 'closed', findingClass: 'minor' },
    { source: 'incident', status: 'open', findingClass: 'major' },
  ],
  suppliers: [
    { id: 's1', status: 'active', certifications: [{ expiresOn: '2026-11-01' }, { expiresOn: '2026-09-01' }, { expiresOn: '2027-09-01' }, { expiresOn: '' }],
      evaluations: [{ evaluatedOn: '2026-04-01', scores: { quality: 5, delivery: 5, specs: 5, documents: 5, support: 5, price: 5 } }, { evaluatedOn: '2025-04-01', scores: { quality: 1 } }],
      nonconformities: [{ date: '2026-02-01', status: 'open' }, { date: '2025-02-01', status: 'closed' }] },
    { id: 's2', status: 'active', certifications: [], evaluations: [{ evaluatedOn: '2026-06-01', scores: { quality: 3, delivery: 3, specs: 3, documents: 3, support: 3, price: 3 } }], nonconformities: [] },
    { id: 's3', status: 'inactive', certifications: [{ expiresOn: '2026-01-01' }], evaluations: [{ evaluatedOn: '2026-06-01', scores: { quality: 1 } }], nonconformities: [{ date: '2026-03-01', status: 'open' }] },
  ],
  kitchen: {
    receipts: [{ receivedOn: '2026-10-01', limitStatus: 'in' }, { receivedOn: '2026-10-02', limitStatus: 'out' }, { receivedOn: '2026-09-02', limitStatus: 'in' }, { receivedOn: '2025-09-02', limitStatus: 'out' }],
    productions: [{ productionDate: '2026-10-17', verifiedAt: '2026-10-17T15:00:00Z' }, { productionDate: '2026-10-18', verifiedAt: null }, { productionDate: '2026-10-19', verifiedAt: null }, { productionDate: '2026-10-20', verifiedAt: null }],
    thermal: [{ processDate: '2026-10-01', limitStatus: 'in' }, { processDate: '2026-10-01', limitStatus: 'out' }, { processDate: '2026-10-01', limitStatus: null }],
    defrosting: [{ endedAt: '2026-10-01T08:00:00Z', verifiedAt: '2026-10-01T09:00:00Z' }, { endedAt: '2026-10-02T08:00:00Z', verifiedAt: null }, { endedAt: '', verifiedAt: null }],
    writeoffs: [{ writtenOffOn: '2026-10-01', reason: 'expired' }],
  },
  surveys: [
    { id: 'sv1', title: 'Ασθενείς', audience: 'patients', questions: [{ id: 'a', type: 'rating' }, { id: 'b', type: 'rating' }, { id: 'c', type: 'text' }] },
    { id: 'sv2', title: 'Προσωπικό', audience: 'staff', questions: [{ id: 'a', type: 'rating' }] },
  ],
  responses: [
    { surveyId: 'sv1', submittedAt: '2026-03-01T10:00:00Z', answers: { a: 5, b: 2, c: 'Ευχαριστώ' } },
    { surveyId: 'sv1', submittedAt: '2026-04-01T10:00:00Z', answers: { a: 4 } },
    { surveyId: 'sv2', submittedAt: '2026-04-01T10:00:00Z', answers: { a: 1 } },
    { surveyId: 'sv2', submittedAt: '2025-04-01T10:00:00Z', answers: { a: 5 } },
  ],
  assessments: [
    { assessedOn: '2026-02-01', status: 'approved', risks: [{ residualL: 4, residualC: 4 }, { residualL: 3, residualC: 3 }, { residualL: 2, residualC: 3 }, { residualL: 1, residualC: 2 }, {}], opportunities: [{ effectivenessStatus: 'pending' }, { effectivenessStatus: '' }, { effectivenessStatus: 'effective' }, { effectivenessStatus: '', effectiveness: 'Αποτελεσματικό· μειώθηκαν οι πτώσεις' }] },
    { assessedOn: '2026-08-01', status: 'draft', risks: [{ residualL: 5, residualC: 5 }], opportunities: [] },
    { assessedOn: '2025-02-01', status: 'archived', risks: [{ residualL: 5, residualC: 5 }], opportunities: [] },
  ],
}

describe('Quality & food safety metrics', () => {
  const q = buildQualityFoodMetrics(sources, range, today)

  it('counts audit answers per standard as compliant over applicable, in the period only', () => {
    expect(q.audits).toBe(2)
    expect(q.auditsPlanned).toBe(1)
    expect(q.answersApplicable).toBe(6)
    expect(q.answersCompliant).toBe(4)
    expect(q.byStandard).toEqual([['iso9001', 4, 2], ['haccp', 2, 2]])
    expect(q.findingsOpen).toBe(2)
    expect(q.findingsMajor).toBe(1)
  })

  it('scores the evaluations of active suppliers and reads certificates as of today', () => {
    expect(q.suppliersActive).toBe(2)
    expect(q.suppliersEvaluated).toBe(2)
    expect(q.evaluations).toBe(2)
    expect(q.evaluationScoreTotal).toBe(160)
    expect(q.evaluationsByResult).toEqual([['approved', 1], ['conditional', 1]])
    expect(q.certificatesExpiring).toBe(1)
    expect(q.certificatesExpired).toBe(1)
    expect(q.nonconformities).toBe(1)
    expect(q.nonconformitiesOpen).toBe(1)
  })

  it('reads kitchen limits, verified past production days and ended defrosts', () => {
    expect([q.receipts, q.receiptsOut]).toEqual([3, 1])
    expect(q.receiptsMonthly).toEqual([['2026-09', 1, 0], ['2026-10', 2, 1]])
    expect([q.productionDays, q.productionDaysVerified]).toEqual([2, 1])
    expect([q.thermalMeasured, q.thermalOut]).toEqual([2, 1])
    expect([q.defrosts, q.defrostsVerified]).toEqual([2, 1])
    expect(q.writeoffsByReason).toEqual([['expired', 1]])
  })

  it('scores satisfaction as 4–5 answers over 1–5 answers, patients apart', () => {
    expect(q.surveyResponses).toBe(3)
    expect([q.ratingAnswers, q.satisfiedAnswers]).toEqual([4, 2])
    expect([q.patientRatingAnswers, q.patientSatisfiedAnswers]).toEqual([3, 2])
    expect(q.bySurvey).toEqual([['Ασθενείς', 2, 3, 2], ['Προσωπικό', 1, 1, 0]])
    expect(q.satisfactionMonthly).toEqual([['2026-03', 2, 1], ['2026-04', 2, 1]])
  })

  it('takes the risks of the assessment in force: a submitted one before a later draft', () => {
    expect(assessmentInForce(sources.assessments, '2026-12-31').assessedOn).toBe('2026-02-01')
    expect(q.risks).toBe(5)
    expect(q.risksByLevel).toEqual([['very_high', 1], ['high', 1], ['moderate', 1], ['low', 1]])
    expect(q.risksHigh).toBe(2)
    expect(q.opportunities).toBe(4)
    expect(q.opportunitiesOpen).toBe(2)
  })

  it('reuses the survey model’s scoring', () => {
    const survey = sources.surveys[0], responses = sources.responses.slice(0, 2)
    const counts = satisfactionCounts(survey, responses)
    expect(counts).toEqual({ answered: 3, satisfied: 2 })
    expect(surveySummary(survey, responses).satisfied).toBe(66.7)
  })

  it('builds Greek KPI tiles and charts with rates', () => {
    const model = qualityFoodSection(q, tx)
    const kpi = name => model.kpis.find(row => row[0] === name)
    expect(kpi('Συμμόρφωση επιθεωρήσεων')[1]).toBe('66,7%')
    expect(kpi('Συμμόρφωση επιθεωρήσεων')[2]).toBe('2 επιθεωρήσεις · 2 ανοιχτά ευρήματα')
    expect(kpi('Συμμόρφωση επιθεωρήσεων')[3]).toBe('danger')
    expect(kpi('Αξιολόγηση προμηθευτών')[1]).toBe('80%')
    expect(kpi('Παραλαβές εκτός ορίων')[1]).toBe('33,3%')
    expect(kpi('Ημέρες με επαλήθευση HACCP')[1]).toBe('50%')
    expect(kpi('Ικανοποίηση')[1]).toBe('50%')
    expect(kpi('Υψηλοί κίνδυνοι')[1]).toBe('2')
    expect(model.charts.find(chart => chart.title === 'Συμμόρφωση ανά πρότυπο').rows).toEqual([['ISO 9001', 50], ['HACCP', 100]])
    expect(model.charts.find(chart => chart.title === 'Κίνδυνοι ανά επίπεδο').rows[0]).toEqual(['Πολύ υψηλός', 1])
    // A one-month trend is left out; two months are drawn.
    expect(qualityFoodSection({ ...q, receiptsMonthly: [['2026-10', 2, 1]] }, tx).charts.some(chart => chart.title.startsWith('Παραλαβές εκτός ορίων ανά μήνα'))).toBe(false)
    expect(model.charts.some(chart => chart.title.startsWith('Παραλαβές εκτός ορίων ανά μήνα'))).toBe(true)
    expect(buildSectionModel('qualityfood', { domains: { qualityFood: q } }, tx).kpis).toHaveLength(6)
  })

  it('adds hospitals up', () => {
    const merged = mergeDomainMetrics([{ qualityFood: q }, { qualityFood: q }]).qualityFood
    expect(merged.answersApplicable).toBe(12)
    expect(merged.byStandard).toEqual([['iso9001', 8, 4], ['haccp', 4, 4]])
    expect(qualityFoodSection(merged, tx).kpis[0][1]).toBe('66,7%')
  })

  it('is a tab of «Οργανισμός» that follows the Quality module', () => {
    expect(TABS.find(tab => tab[0] === 'qualityfood').slice(1, 3)).toEqual(['Ποιότητα & ασφάλεια τροφίμων', 'Quality & food safety'])
    expect(TAB_MODULES.qualityfood).toEqual(['quality'])
    expect(analysisGroups(TABS).find(group => group.id === 'organisation').tabs.map(tab => tab[0])).toContain('qualityfood')
  })

  it('gives the demo the same shape from the demo stores', () => {
    const demo = collectDemoQualityFood(range, today)
    expect(Object.keys(demo).sort()).toEqual(Object.keys(q).sort())
    expect(demo.audits).toBeGreaterThan(0)
    expect(demo.suppliersActive).toBeGreaterThan(0)
    expect(demo.risks).toBeGreaterThan(0)
  })
})

describe('Quality & food safety server metrics', () => {
  const sql = read('supabase/migrations/20261126100000_analysis_quality_food_metrics.sql')

  it('is a security definer RPC with an empty search path and the analysis access check', () => {
    expect(sql).toMatch(/create or replace function public\.analysis_quality_food_metrics\(\s*p_organization_id uuid default null,\s*p_from date default null,\s*p_to date default null,\s*p_department_id uuid default null\s*\) returns jsonb/)
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('public.current_user_is_platform_owner()')
    expect(sql).toContain("array['hospital_admin','infection_control_lead','quality_manager']::public.app_role[]")
    expect(sql).toContain("raise exception 'analytics access denied'")
    expect(sql).toContain('revoke all on function public.analysis_quality_food_metrics(uuid, date, date, uuid) from public;')
    expect(sql).toContain('grant execute on function public.analysis_quality_food_metrics(uuid, date, date, uuid) to authenticated;')
    expect(sql).not.toMatch(/create\s+temp/i)
  })

  it('filters dates on the columns themselves and returns every key the demo builds', () => {
    expect(sql).toContain('a.completed_date >= p_from')
    expect(sql).toContain('r.received_on >= p_from')
    expect(sql).toContain('r.submitted_at < p_to + 1')
    const keys = Object.keys(buildQualityFoodMetrics({}, range, today))
    for (const key of keys) expect(sql).toContain(`'${key}'`)
  })

  it('is listed in the security-definer manifest and read by the analysis loader', () => {
    const manifest = JSON.parse(read('supabase/security-definer-manifest.json'))
    expect(manifest.functions.analysis_quality_food_metrics).toMatchObject({ category: 'rpc', authenticated: true })
    expect(read('src/features/platform/platformService.js')).toContain("supabase.rpc('analysis_quality_food_metrics'")
  })

  it('migration timestamps stay unique', () => {
    const stamps = fs.readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).map(name => name.split('_')[0])
    expect(new Set(stamps).size).toBe(stamps.length)
  })
})

describe('Quality & food safety indicators', () => {
  const dir = 'supabase/migrations'
  const latest = fs.readdirSync(dir).filter(name => name.endsWith('.sql') && fs.readFileSync(path.join(dir, name), 'utf8').includes('function private.indicator_metric_snapshot')).sort().at(-1)
  const sql = fs.readFileSync(path.join(dir, latest), 'utf8')
  const KEYS = ['audit-answers-compliance', 'kitchen-receipts-out-of-limits', 'kitchen-days-haccp-verified', 'supplier-evaluation-average', 'patient-satisfaction', 'quality-risks-high']
  const METRICS = Object.keys(qualityFoodIndicatorMetrics({}))

  it('the latest snapshot body carries the six new metrics in a chunk of their own', () => {
    expect(latest).toBe('20261126100100_quality_food_indicators.sql')
    expect(sql).toContain("set search_path to ''")
    expect(sql).toContain("|| jsonb_build_object('audit_answers_compliant',v_qa_ok,")
    for (const metric of METRICS) expect(sql).toContain(`'${metric}'`)
    // The earlier metrics are still there.
    expect(sql).toContain("'pps_patients_on_antibiotics',v_pps_abx)")
  })

  it('inserts the system definitions once, organization null, auto, with direction and target', () => {
    expect(sql).toContain('insert into public.indicator_definitions (')
    expect(sql).toContain("select null, x.k, '2026.4'")
    expect(sql).toContain("where d.organization_id is null and d.indicator_key = x.k and d.version = '2026.4'")
    for (const key of KEYS) expect(sql).toContain(`('${key}',`)
    expect(sql).toMatch(/'kitchen_receipts_out_of_limits', 'kitchen_receipts', 100::numeric, '%', '%', '[^']+', 5::numeric, 'lower'\)/)
    expect(sql).toMatch(/'quality_risks_high', null, 1::numeric, 'κίνδυνοι', 'risks', '[^']+', null::numeric, 'lower'\)/)
  })

  it('the demo has the same definitions and computes their metrics', () => {
    const rows = indicatorDefinitionRows.filter(row => KEYS.includes(row.indicator_key))
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(row.organization_id).toBeNull()
      expect(row.calculation_type).toBe('auto')
      expect(row.category).toBe('quality')
      expect(sql).toContain(`'${row.numerator_metric}'`)
    }
    expect(rows.find(row => row.indicator_key === 'kitchen-days-haccp-verified').direction).toBe('higher')
    const metrics = collectIndicatorMetrics()
    for (const metric of METRICS) expect(typeof metrics[metric]).toBe('number')
    expect(metrics.audit_answers_applicable).toBeGreaterThan(0)
  })
})
