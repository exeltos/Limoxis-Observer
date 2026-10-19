import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyTemplate, evaluationFromTemplate, evaluationMonths, evaluationResult, evaluationSheetRows, evaluationTotal, everyCriterionScored, formatPercent, moveCriterion, newTemplate, presetTemplates, resultFor, templateFor, templateProblems, templatesFor, weightTotal, weightedScore } from '../src/features/quality/resources/supplierTemplates'
import { evaluationApproval, evaluationPercent, supplierCategoryLabel, supplierStatus, withSupplierStatus } from '../src/features/quality/resources/resourceModel'
import { criterionRows, evaluationFromRow, evaluationRows, scoreRows, templateChanged, templateFromRow } from '../src/features/quality/resources/supplierRelations'
import { supplierEvaluationDocument } from '../src/features/quality/resources/supplierEvaluationReport'
import { demoResources } from '../src/features/quality/resources/resourceDemoData'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'

const TODAY = '2026-10-18'
const KITCHEN = presetTemplates('t').find(item => item.id === 't-kitchen')
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('Supplier evaluation templates', () => {
  it('ships the three FileMaker templates and a laboratory one, each with weights adding up to 1', () => {
    const presets = presetTemplates('t')
    expect(presets.map(item => item.name)).toEqual(['Προμηθευτής Προϊόντων', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', 'Προμηθευτής Κουζίνας', 'Προμηθευτής Εργαστηρίου'])
    for (const template of presets) expect(weightTotal(template.criteria)).toBe(1)
    // The FileMaker first criteria keep their weights: products 0,20, kitchen 0,12.
    expect(presets[0].criteria[0]).toMatchObject({ label: 'Ποιότητα προϊόντων', weight: 0.2 })
    expect(KITCHEN.criteria[0]).toMatchObject({ label: 'Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών', weight: 0.12 })
    expect(presets[3].criteria.map(item => item.label).join(' ')).toMatch(/CE-IVD.*ISO 15189|ISO 15189/)
    expect(presets[3].criteria.map(item => item.label).join(' ')).toMatch(/Ψυχρή αλυσίδα/)
  })

  it('picks the template of the supplier category, a general one after, inactive ones never', () => {
    const general = { id: 'g', name: 'Γενικό', categories: [], active: true, criteria: [] }
    const off = { ...KITCHEN, id: 'off', name: 'Παλιό κουζίνας', active: false }
    const all = [...presetTemplates('t'), general, off]
    expect(templateFor(all, 'kitchen').name).toBe('Προμηθευτής Κουζίνας')
    expect(templatesFor(all, 'kitchen').map(item => item.id)).toEqual(['t-kitchen', 'g'])
    expect(templateFor(all, 'consumables').name).toBe('Προμηθευτής Προϊόντων')
    expect(templateFor(all, 'certification_body').name).toBe('Προμηθευτής Υπηρεσιών/Υπεργολάβος')
    expect(templateFor([off], 'kitchen')).toBeNull()
  })

  it('works out the weighted score live and the verdict by the thresholds', () => {
    const criteria = [{ weight: 0.2, score: 5 }, { weight: 0.3, score: 3 }, { weight: 0.5, score: '' }]
    // Only the scored ones count: (1 × 0.2 + 0.6 × 0.3) / 0.5 = 76%.
    expect(weightedScore(criteria, 5)).toBe(76)
    expect(weightedScore([{ weight: 1, score: 7 }], 10)).toBe(70)
    expect(weightedScore([{ weight: 1, score: '' }])).toBeNull()
    expect([resultFor(70, 70, 50), resultFor(69.9, 70, 50), resultFor(50, 70, 50), resultFor(49, 70, 50), resultFor(null)]).toEqual(['approved', 'conditional', 'conditional', 'rejected', 'unevaluated'])
    expect(formatPercent(76.5)).toBe('76,5%')
    expect(formatPercent(null)).toBe('—')
  })

  it('starts an evaluation on the template with its snapshot, and keeps scores when the template is chosen again', () => {
    const evaluation = evaluationFromTemplate(KITCHEN, TODAY)
    expect(evaluation).toMatchObject({ templateId: 't-kitchen', templateName: 'Προμηθευτής Κουζίνας', templateVersion: 1, passThreshold: 70, conditionalThreshold: 50, scoreScale: 5 })
    expect(evaluation.criteria).toHaveLength(8)
    expect(everyCriterionScored(evaluation)).toBe(false)
    const scored = { ...evaluation, criteria: evaluation.criteria.map(item => ({ ...item, score: 4 })) }
    expect(everyCriterionScored(scored)).toBe(true)
    expect(evaluationTotal(scored)).toBe(80)
    expect(evaluationResult(scored)).toBe('approved')
    expect(applyTemplate(scored, KITCHEN).criteria.every(item => item.score === 4)).toBe(true)
    expect(applyTemplate(scored, presetTemplates('t')[0]).criteria.every(item => item.score === '')).toBe(true)
  })

  it('a FileMaker evaluation keeps its total; the criteria it did not record are not invented', () => {
    const imported = { id: 'e', evaluatedOn: '2025-06-13', templateName: 'Προμηθευτής Προϊόντων', scoreScale: 10, passThreshold: 70, conditionalThreshold: 50, criteriaScores: 'partial', totalScore: 76.5, criteria: [{ criterionId: 'c1', label: 'Ποιότητα Προϊόντων', weight: 0.2, score: 7 }] }
    expect(evaluationTotal(imported)).toBe(76.5)
    expect(evaluationResult(imported)).toBe('approved')
    expect(evaluationSheetRows(imported)).toEqual([['1', 'Ποιότητα Προϊόντων', '0,2', '7 / 10', '0,14']])
    expect(evaluationSheetRows({ ...imported, criteria: [...imported.criteria, { label: 'Συνέπεια', weight: 0.2, score: '' }] })[1][3]).toBe('δεν καταγράφηκε')
    // An out-of-scale FileMaker total is kept as no result.
    expect(evaluationTotal({ ...imported, totalScore: null })).toBeNull()
  })

  it('checks a template before it is saved and reorders its criteria', () => {
    expect(templateProblems({ ...newTemplate(), name: 'Π', criteria: [{ label: '', weight: 0 }], passThreshold: 50, conditionalThreshold: 60, frequencyMonths: 0 })).toEqual(['όνομα', 'περιγραφή σε κάθε κριτήριο', 'βάρος πάνω από 0 σε κάθε κριτήριο', 'όριο «υπό όρους» όχι πάνω από το όριο έγκρισης', 'συχνότητα 1–60 μήνες'])
    expect(templateProblems(KITCHEN)).toEqual([])
    expect(moveCriterion(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveCriterion(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('Suppliers on templates', () => {
  const supplier = (extra = {}) => ({ id: 's1', code: 'SUP-001', name: 'Γαλακτοκομικά', category: 'kitchen', status: 'active', certifications: [], nonconformities: [], evaluations: [], ...extra })

  it('dates the next evaluation from the latest one and the frequency of the supplier, its template or 12 months', () => {
    const evaluation = { ...evaluationFromTemplate(KITCHEN, '2026-01-10'), criteria: KITCHEN.criteria.map(item => ({ criterionId: item.id, label: item.label, weight: item.weight, score: 3 })) }
    const templates = [{ ...KITCHEN, frequencyMonths: 6 }]
    expect(supplierStatus(supplier({ evaluations: [evaluation] }), TODAY, templates)).toMatchObject({ score: 60, approval: 'conditional', nextEvaluation: '2026-07-10', evaluationDue: true, evaluationMonths: 6 })
    expect(supplierStatus(supplier({ evaluations: [evaluation], evaluationMonths: 12 }), TODAY, templates)).toMatchObject({ nextEvaluation: '2027-01-10', evaluationDue: false })
    expect(evaluationMonths(supplier(), null, [])).toBe(12)
    // No scored evaluation: the decision recorded on the supplier.
    expect(supplierStatus(supplier({ approvalStatus: 'conditional' }), TODAY).approval).toBe('conditional')
  })

  it('earlier six-criterion evaluations still render and score as before', () => {
    const legacy = { evaluatedOn: '2025-09-01', scores: { quality: 3, delivery: 2, specs: 3, documents: 3, support: 3, price: 3 } }
    expect(evaluationPercent(legacy)).toBe(57)
    expect(evaluationApproval(legacy)).toBe('rejected')
    expect(evaluationFromRow({ id: 'e', evaluated_on: '2025-09-01', scores: [{ criterion: 'quality', score: 4, weight: '1.00' }] }).scores.quality).toBe(4)
    expect(supplierCategoryLabel('catering')).toBe('Κουζίνα / τρόφιμα')
  })

  it('stores a template evaluation with its snapshot and a row per criterion with label and weight', () => {
    const evaluation = { ...evaluationFromTemplate({ ...KITCHEN, id: uuid(1), criteria: KITCHEN.criteria.map((item, index) => ({ ...item, id: uuid(10 + index) })) }, TODAY), id: uuid(2) }
    evaluation.criteria = evaluation.criteria.map((item, index) => ({ ...item, score: index === 0 ? 5 : 4 }))
    const [row] = evaluationRows([evaluation])
    expect(row).toMatchObject({ template_id: uuid(1), template_name: 'Προμηθευτής Κουζίνας', template_version: 1, score_scale: 5, pass_threshold: 70, result: 'approved', criteria_scores: 'complete' })
    expect(row.total_score).toBeCloseTo(82.4, 1)
    const scores = scoreRows(evaluation, [{ id: uuid(99), criterion_id: uuid(10) }])
    expect(scores).toHaveLength(8)
    expect(scores[0]).toMatchObject({ id: uuid(99), criterion: null, criterion_id: uuid(10), criterion_label: 'Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών', weight: 0.12, score_scale: 5, score: 5, position: 0 })
    // Read back: the evaluation keeps the label and weight it was scored on.
    const back = evaluationFromRow({ id: uuid(2), evaluated_on: TODAY, template_id: uuid(1), template_name: 'Προμηθευτής Κουζίνας', template_version: 3, pass_threshold: '70.00', conditional_threshold: '50.00', score_scale: 5, total_score: '82.40', criteria_scores: 'complete', scores: scores.map(item => ({ ...item, weight: String(item.weight) })) })
    expect(back).toMatchObject({ templateVersion: 3, passThreshold: 70 })
    expect(back.criteria[0]).toMatchObject({ label: 'Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών', weight: 0.12, score: 5 })
    expect(evaluationTotal(back)).toBeCloseTo(82.4, 1)
  })

  it('a template edit raises the version only when what an evaluation keeps changes', () => {
    expect(templateChanged(KITCHEN, { ...KITCHEN, description: 'νέα περιγραφή', categories: ['kitchen', 'products'] })).toBe(false)
    expect(templateChanged(KITCHEN, { ...KITCHEN, criteria: KITCHEN.criteria.map((item, index) => (index ? item : { ...item, weight: 0.2 })) })).toBe(true)
    expect(templateChanged(null, KITCHEN)).toBe(false)
    expect(criterionRows([{ id: 'x', label: ' Α ', weight: '0.5' }, { id: 'y', label: '' }])).toMatchObject([{ position: 0, label: 'Α', weight: 0.5 }])
    expect(templateFromRow({ id: 't', name: 'Τ', pass_threshold: '70.00', conditional_threshold: '50.00', frequency_months: 6, score_scale: 10, criteria: [{ id: 'b', position: 1, label: 'Β', weight: '0.4' }, { id: 'a', position: 0, label: 'Α', weight: '0.6' }] })).toMatchObject({ passThreshold: 70, frequencyMonths: 6, scoreScale: 10, criteria: [{ label: 'Α', weight: 0.6 }, { label: 'Β', weight: 0.4 }] })
  })

  it('the evaluation sheet is the shared report with the criteria table, the result and signatures', () => {
    const state = demoResources()
    const rows = withSupplierStatus(state.suppliers, [], undefined, state.templates)
    const kitchen = rows.find(item => item.category === 'kitchen' && item.latestEvaluation)
    const doc = supplierEvaluationDocument(kitchen, kitchen.latestEvaluation, { nextEvaluation: kitchen.nextEvaluation, months: kitchen.evaluationMonths })
    expect(doc.kind).toBe('Φύλλο αξιολόγησης προμηθευτή')
    expect(doc.sections[0].table.rows).toHaveLength(8)
    expect(evaluationSheetRows({ scoreScale: 5, criteria: [{ label: 'Θ', weight: 0.14, score: 4 }] })[0][4]).toBe('0,112')
    expect(doc.meta.find(([label]) => label === 'Αποτέλεσμα')[1]).toMatch(/%/)
    expect(doc.signatures).toEqual(['Αξιολογητής', 'Υπεύθυνος Ποιότητας'])
  })

  it('the demo has templates for the four kinds and puts each next evaluation on the calendar', () => {
    const state = demoResources()
    expect(state.templates).toHaveLength(4)
    const rows = withSupplierStatus(state.suppliers, [], undefined, state.templates)
    const events = buildCalendarEvents({ suppliers: rows }, { today: TODAY })
    const supplierEvents = events.filter(event => event.kind === 'suppliers')
    expect(supplierEvents.length).toBe(rows.filter(row => row.nextEvaluation).length)
    expect(supplierEvents[0].detail).toMatch(/^Αξιολόγηση προμηθευτή/)
  })

  it('the database keeps templates to Quality and lets only Quality managers edit them', () => {
    const sql = fs.readFileSync('supabase/migrations/20261122100000_quality_supplier_eval_templates.sql', 'utf8')
    expect(sql).toContain("'quality_supplier_eval_templates', 'quality_supplier_eval_template_criteria', 'quality_supplier_evaluation_scores', 'quality_supplier_contacts'")
    expect(sql).toMatch(/for select to authenticated using \(\s*\(select public\.current_user_is_platform_owner\(\)\)\s*or organization_id = any \(\(select private\.current_user_quality_read_orgs\(\)\)/)
    expect(sql).toMatch(/for insert to authenticated\s*with check \(\(select public\.current_user_is_platform_owner\(\)\) or organization_id = any \(\(select private\.current_user_quality_manage_orgs\(\)\)/)
    // The earlier fixed criteria stay valid; a template criterion has none.
    expect(sql).toContain("criterion text check (criterion is null or criterion in ('quality', 'delivery', 'specs', 'documents', 'support', 'price'))")
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint)\b/i)
  })
})
