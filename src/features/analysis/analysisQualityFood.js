// «Ποιότητα & ασφάλεια τροφίμων» of the Analysis page: audits, suppliers, the
// kitchen (HACCP), satisfaction surveys and risks. Production reads the shape
// from analysis_quality_food_metrics (20261126100000); the demo builds the very
// same shape here from the demo stores. Plain counters and [key, ...counts]
// rows only, so mergeDomainMetrics adds hospitals up; rates are worked out
// when shown. Counts only — never a name of a patient or an employee.
import { evaluationPercent, evaluationApproval, EXPIRY_SOON_DAYS } from '../quality/resources/resourceModel'
import { satisfactionCounts } from '../quality/surveys/surveyModel'
import { normalizeOpportunity, scored } from '../quality/risk/riskModel'
import { FINDING_CLASSES, standardShort } from '../quality/audits/auditStandards'

const day = value => String(value || '').slice(0, 10)
const month = value => String(value || '').slice(0, 7)
const inRange = (value, range) => { const d = day(value); if (!d) return false; return (!range?.from || d >= range.from) && (!range?.to || d <= range.to) }
const addDays = (iso, days) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const rows = map => [...map.entries()].map(([key, values]) => [key, ...values])
function add(map, key, values) { if (!key) return; const current = map.get(key) || values.map(() => 0); values.forEach((value, index) => { current[index] += Number(value) || 0 }); map.set(key, current) }
const byCount = list => list.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
const byKey = list => list.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
const CLOSED_FINDING = new Set(['closed', 'resolved', 'completed', 'verified'])
const APPLICABLE = new Set(['yes', 'partial', 'no'])
// The residual level of a risk on the 5×5 matrix (riskModel bands).
const RISK_LEVELS = ['very_high', 'high', 'moderate', 'low']

// The risk assessment in force at the end of the period: the latest one assessed
// by then, a submitted one before a draft (same rule as the server).
export function assessmentInForce(assessments = [], to = '') {
  const eligible = assessments.filter(item => item.assessedOn && (!to || day(item.assessedOn) <= to) && item.lifecycleStatus !== 'voided')
  return eligible.sort((a, b) => Number(a.status === 'draft') - Number(b.status === 'draft') || String(b.assessedOn).localeCompare(String(a.assessedOn)))[0] || null
}

// sources: { audits, findings, suppliers, kitchen: { receipts, productions,
// thermal, defrosting, writeoffs } (with limitStatus), surveys, responses,
// assessments } in the app's shape. today: the day the state counts from
// (certificates, past production days).
export function buildQualityFoodMetrics(sources = {}, range = {}, today = new Date().toISOString().slice(0, 10)) {
  const { audits = [], findings = [], suppliers = [], kitchen = {}, surveys = [], responses = [], assessments = [] } = sources

  // Audits completed in the period and their answers per standard.
  const done = audits.filter(item => item.status === 'completed' && item.lifecycleStatus !== 'voided' && inRange(item.completedDate, range))
  const planned = audits.filter(item => !['completed', 'cancelled'].includes(item.status) && item.lifecycleStatus !== 'voided' && inRange(item.plannedDate, range))
  const standards = new Map()
  for (const item of done) {
    const answers = (item.checklist || []).filter(row => APPLICABLE.has(row.answer))
    add(standards, item.standard || 'other', [answers.length, answers.filter(row => row.answer === 'yes').length])
  }
  const openFindings = findings.filter(item => item.source === 'audit' && item.lifecycleStatus !== 'voided' && !CLOSED_FINDING.has(item.status))
  const findingClasses = new Map()
  for (const item of openFindings) add(findingClasses, item.findingClass || 'unclassified', [1])

  // Suppliers: the active ones, their evaluations of the period, certificates now.
  const active = suppliers.filter(item => (item.status || 'active') === 'active')
  const evaluations = active.flatMap(item => (item.evaluations || []).filter(row => inRange(row.evaluatedOn, range)).map(row => ({ supplierId: item.id, score: evaluationPercent(row), result: evaluationApproval(row) })))
  const scoredEvaluations = evaluations.filter(row => row.score != null)
  const results = new Map()
  for (const row of scoredEvaluations) if (['approved', 'conditional', 'rejected'].includes(row.result)) add(results, row.result, [1])
  const certificates = active.flatMap(item => item.certifications || []).filter(row => row.expiresOn)
  const soon = addDays(today, EXPIRY_SOON_DAYS)
  const nonconformities = active.flatMap(item => item.nonconformities || [])

  // Kitchen (HACCP): records of the period and their in / out of limits status.
  const receipts = (kitchen.receipts || []).filter(row => inRange(row.receivedOn, range))
  const receiptMonths = new Map()
  for (const row of receipts) add(receiptMonths, month(row.receivedOn), [1, row.limitStatus === 'out' ? 1 : 0])
  const days = (kitchen.productions || []).filter(row => inRange(row.productionDate, range) && day(row.productionDate) < today)
  const thermal = (kitchen.thermal || []).filter(row => inRange(row.processDate, range) && row.limitStatus)
  const defrosts = (kitchen.defrosting || []).filter(row => row.endedAt && inRange(row.endedAt, range))
  const writeoffs = (kitchen.writeoffs || []).filter(row => inRange(row.writtenOffOn, range))
  const reasons = new Map()
  for (const row of writeoffs) add(reasons, row.reason || 'other', [1])

  // Satisfaction: the 1–5 answers of the period, per survey and month.
  const periodResponses = responses.filter(row => inRange(row.submittedAt, range))
  const bySurvey = new Map(), satisfactionMonths = new Map()
  let answered = 0, satisfied = 0, patientAnswered = 0, patientSatisfied = 0
  for (const survey of surveys) {
    const own = periodResponses.filter(row => row.surveyId === survey.id)
    if (!own.length) continue
    const counts = satisfactionCounts(survey, own)
    answered += counts.answered; satisfied += counts.satisfied
    if (survey.audience === 'patients') { patientAnswered += counts.answered; patientSatisfied += counts.satisfied }
    add(bySurvey, survey.title || survey.code || '—', [own.length, counts.answered, counts.satisfied])
    const months = new Map()
    for (const row of own) { const key = month(row.submittedAt); if (!months.has(key)) months.set(key, []); months.get(key).push(row) }
    for (const [key, list] of months) { const c = satisfactionCounts(survey, list); add(satisfactionMonths, key, [c.answered, c.satisfied]) }
  }

  // Risks: the assessment in force at the end of the period.
  const current = assessmentInForce(assessments, range?.to)
  const levels = new Map(RISK_LEVELS.map(id => [id, [0]]))
  for (const risk of current?.risks || []) { const level = scored(risk).residual.level; if (level) add(levels, level, [1]) }
  // An opportunity is open while its effectiveness is not assessed (status, or read from its note).
  const opportunities = (current?.opportunities || []).map(normalizeOpportunity)

  return {
    audits: done.length,
    auditsPlanned: planned.length,
    answersApplicable: [...standards.values()].reduce((sum, [n]) => sum + n, 0),
    answersCompliant: [...standards.values()].reduce((sum, [, n]) => sum + n, 0),
    byStandard: byCount(rows(standards)),
    findingsOpen: openFindings.length,
    findingsMajor: openFindings.filter(item => item.findingClass === 'major').length,
    findingsByClass: byCount(rows(findingClasses)),
    suppliersActive: active.length,
    suppliersEvaluated: new Set(scoredEvaluations.map(row => row.supplierId)).size,
    evaluations: scoredEvaluations.length,
    evaluationScoreTotal: Math.round(scoredEvaluations.reduce((sum, row) => sum + Number(row.score), 0) * 10) / 10,
    evaluationsByResult: byCount(rows(results)),
    certificatesExpiring: certificates.filter(row => day(row.expiresOn) >= today && day(row.expiresOn) <= soon).length,
    certificatesExpired: certificates.filter(row => day(row.expiresOn) < today).length,
    nonconformities: nonconformities.filter(row => inRange(row.date, range)).length,
    nonconformitiesOpen: nonconformities.filter(row => row.status !== 'closed').length,
    receipts: receipts.length,
    receiptsOut: receipts.filter(row => row.limitStatus === 'out').length,
    receiptsMonthly: byKey(rows(receiptMonths)),
    productionDays: days.length,
    productionDaysVerified: days.filter(row => row.verifiedAt).length,
    thermalMeasured: thermal.length,
    thermalOut: thermal.filter(row => row.limitStatus === 'out').length,
    defrosts: defrosts.length,
    defrostsVerified: defrosts.filter(row => row.verifiedAt).length,
    writeoffs: writeoffs.length,
    writeoffsByReason: byCount(rows(reasons)),
    surveyResponses: periodResponses.filter(row => surveys.some(survey => survey.id === row.surveyId)).length,
    ratingAnswers: answered,
    satisfiedAnswers: satisfied,
    patientRatingAnswers: patientAnswered,
    patientSatisfiedAnswers: patientSatisfied,
    bySurvey: byCount(rows(bySurvey)),
    satisfactionMonthly: byKey(rows(satisfactionMonths)),
    risks: (current?.risks || []).length,
    risksByLevel: rows(levels),
    risksHigh: (levels.get('high')?.[0] || 0) + (levels.get('very_high')?.[0] || 0),
    opportunities: opportunities.length,
    opportunitiesOpen: opportunities.filter(row => !row.effectivenessStatus || row.effectivenessStatus === 'pending').length,
  }
}

// The indicator metrics (private.indicator_metric_snapshot keys) from the same shape.
export function qualityFoodIndicatorMetrics(q = {}) {
  return {
    audit_answers_compliant: q.answersCompliant ?? 0,
    audit_answers_applicable: q.answersApplicable ?? 0,
    kitchen_receipts_out_of_limits: q.receiptsOut ?? 0,
    kitchen_receipts: q.receipts ?? 0,
    kitchen_production_days_verified: q.productionDaysVerified ?? 0,
    kitchen_production_days: q.productionDays ?? 0,
    supplier_evaluation_score_total: q.evaluationScoreTotal ?? 0,
    supplier_evaluations_scored: q.evaluations ?? 0,
    patient_satisfied_answers: q.patientSatisfiedAnswers ?? 0,
    patient_rating_answers: q.patientRatingAnswers ?? 0,
    quality_risks_high: q.risksHigh ?? 0,
  }
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null)
const fmtPct = value => (value == null ? '—' : `${String(value).replace('.', ',')}%`)
const LABELS = {
  approved: ['Εγκεκριμένοι', 'Approved'], conditional: ['Υπό όρους', 'Conditional'], rejected: ['Απορρίφθηκαν', 'Rejected'],
  very_high: ['Πολύ υψηλός', 'Very high'], high: ['Υψηλός', 'High'], moderate: ['Μέτριος', 'Moderate'], low: ['Χαμηλός', 'Low'],
  expired: ['Λήξη', 'Expired'], spoiled: ['Αλλοίωση', 'Spoiled'], damaged: ['Φθορά', 'Damaged'], temperature: ['Θερμοκρασία', 'Temperature'], recall: ['Ανάκληση', 'Recall'], other: ['Άλλο', 'Other'],
  unclassified: ['Χωρίς κατηγορία', 'Unclassified'],
  ...Object.fromEntries(FINDING_CLASSES.map(item => [item.value, item.label])),
}

// KPI tiles and charts of the section.
export function qualityFoodSection(q = {}, tx) {
  const en = tx('el', 'en') === 'en'
  const label = key => { const pair = LABELS[key]; return pair ? pair[en ? 1 : 0] : key }
  const named = list => (list || []).map(([key, ...values]) => [label(key), ...values])
  const compliance = pct(q.answersCompliant, q.answersApplicable)
  const supplierScore = q.evaluations ? Math.round((q.evaluationScoreTotal / q.evaluations) * 10) / 10 : null
  const receiptsOut = pct(q.receiptsOut, q.receipts)
  const daysVerified = pct(q.productionDaysVerified, q.productionDays)
  const satisfaction = pct(q.satisfiedAnswers, q.ratingAnswers)
  const patients = pct(q.patientSatisfiedAnswers, q.patientRatingAnswers)
  const n = value => Number(value ?? 0).toLocaleString(en ? 'en-US' : 'el-GR')
  return {
    kpis: [
      [tx('Συμμόρφωση επιθεωρήσεων', 'Audit compliance'), fmtPct(compliance), tx(`${n(q.audits)} επιθεωρήσεις · ${n(q.findingsOpen)} ${q.findingsOpen === 1 ? 'ανοιχτό εύρημα' : 'ανοιχτά ευρήματα'}`, `${n(q.audits)} audits · ${n(q.findingsOpen)} open ${q.findingsOpen === 1 ? 'finding' : 'findings'}`), q.findingsMajor ? 'danger' : compliance == null ? '' : compliance < 90 ? 'warning' : 'good'],
      [tx('Αξιολόγηση προμηθευτών', 'Supplier evaluation'), fmtPct(supplierScore), tx(`${n(q.suppliersEvaluated)} από ${n(q.suppliersActive)} ενεργούς · ${n(q.certificatesExpiring + (q.certificatesExpired || 0))} πιστοποιητικά σε λήξη`, `${n(q.suppliersEvaluated)} of ${n(q.suppliersActive)} active · ${n(q.certificatesExpiring + (q.certificatesExpired || 0))} certificates expiring`), q.certificatesExpired ? 'danger' : supplierScore == null ? '' : supplierScore < 80 ? 'warning' : 'good'],
      [tx('Παραλαβές εκτός ορίων', 'Receipts out of limits'), fmtPct(receiptsOut), tx(`${n(q.receiptsOut)} από ${n(q.receipts)} παραλαβές`, `${n(q.receiptsOut)} of ${n(q.receipts)} receipts`), receiptsOut == null ? '' : receiptsOut > 5 ? 'warning' : 'good'],
      [tx('Ημέρες με επαλήθευση HACCP', 'Days HACCP-verified'), fmtPct(daysVerified), tx(`${n(q.productionDaysVerified)} από ${n(q.productionDays)} ημέρες παραγωγής`, `${n(q.productionDaysVerified)} of ${n(q.productionDays)} production days`), daysVerified == null ? '' : daysVerified < 95 ? 'warning' : 'good'],
      [tx('Ικανοποίηση', 'Satisfaction'), fmtPct(satisfaction), patients == null ? tx(`${n(q.surveyResponses)} απαντήσεις`, `${n(q.surveyResponses)} responses`) : tx(`${n(q.surveyResponses)} απαντήσεις · ασθενείς ${fmtPct(patients)}`, `${n(q.surveyResponses)} responses · patients ${fmtPct(patients)}`), satisfaction == null ? '' : satisfaction < 80 ? 'warning' : 'good'],
      [tx('Υψηλοί κίνδυνοι', 'High risks'), n(q.risksHigh), tx(`${n(q.risks)} κίνδυνοι · ${n(q.opportunitiesOpen)} ανοιχτές ευκαιρίες`, `${n(q.risks)} risks · ${n(q.opportunitiesOpen)} open opportunities`), q.risksHigh ? 'danger' : ''],
    ],
    charts: [
      { type: 'rate', title: tx('Συμμόρφωση ανά πρότυπο', 'Compliance by standard'), subtitle: tx('Απαντήσεις «Συμμορφώνεται» προς όσες εφαρμόζονται, στις επιθεωρήσεις της περιόδου.', '«Conforms» answers over applicable ones, in the audits of the period.'), rows: (q.byStandard || []).map(([key, applicable, compliant]) => [standardShort(key) === 'Άλλο' && en ? 'Other' : standardShort(key), pct(compliant, applicable) ?? 0]) },
      { type: 'bars', title: tx('Ανοιχτά ευρήματα επιθεωρήσεων', 'Open audit findings'), subtitle: tx('Ανά κατηγορία ευρήματος, όπως είναι σήμερα.', 'By finding class, as they stand today.'), rows: named(q.findingsByClass) },
      { type: 'rate', title: tx('Κουζίνα: δείκτες HACCP', 'Kitchen: HACCP measures'), subtitle: tx('Παραλαβές και θερμικές επεξεργασίες (μαγείρεμα, ψύξη, αναθέρμανση, τηγάνισμα) εντός ορίων· ημέρες παραγωγής και αποψύξεις με επαλήθευση.', 'Receipts and heat treatments (cooking, chilling, reheating, frying) within limits; production days and defrosts verified.'), rows: [
        [tx('Παραλαβές εντός ορίων', 'Receipts in limits'), q.receipts ? 100 - (receiptsOut ?? 0) : null],
        [tx('Θερμοκρασίες εντός ορίων', 'Heat treatments in limits'), q.thermalMeasured ? 100 - (pct(q.thermalOut, q.thermalMeasured) ?? 0) : null],
        [tx('Ημέρες επαληθευμένες', 'Days verified'), daysVerified],
        [tx('Αποψύξεις επαληθευμένες', 'Defrosts verified'), pct(q.defrostsVerified, q.defrosts)],
      ].filter(([, value]) => value != null).map(([key, value]) => [key, Math.round(value * 10) / 10]) },
      { type: 'trend', wide: true, sparse: true, title: tx('Παραλαβές εκτός ορίων ανά μήνα (%)', 'Receipts out of limits by month (%)'), subtitle: tx('Παραλαβές με μέτρηση ή έλεγχο εκτός ορίων προς το σύνολο του μήνα.', 'Receipts with a measurement or check out of limits over the month’s receipts.'), points: (q.receiptsMonthly || []).map(([key, total, out]) => [key, pct(out, total) ?? 0]) },
      { type: 'bars', title: tx('Προμηθευτές', 'Suppliers'), subtitle: tx('Αξιολογήσεις και μη συμμορφώσεις της περιόδου· πιστοποιητικά (σε λήξη, ληγμένα) όπως είναι σήμερα.', 'Evaluations and nonconformities of the period; certificates (expiring, expired) as they stand today.'), rows: [
        [tx('Ενεργοί', 'Active'), q.suppliersActive ?? 0],
        [tx('Αξιολογήθηκαν', 'Evaluated'), q.suppliersEvaluated ?? 0],
        [tx('Λήγουν σε 60 ημέρες', 'Expire in 60 days'), q.certificatesExpiring ?? 0],
        [tx('Ληγμένα', 'Expired'), q.certificatesExpired ?? 0],
        [tx('Νέες μη συμμορφώσεις', 'New nonconformities'), q.nonconformities ?? 0],
        [tx('Ανοιχτές μη συμμορφώσεις', 'Open nonconformities'), q.nonconformitiesOpen ?? 0],
      ] },
      { type: 'donut', title: tx('Αποτέλεσμα αξιολογήσεων', 'Evaluation results'), subtitle: tx('Αξιολογήσεις προμηθευτών της περιόδου.', 'Supplier evaluations in the period.'), rows: named(q.evaluationsByResult), center: tx('αξιολογήσεις', 'evaluations') },
      { type: 'rate', title: tx('Ικανοποίηση ανά έρευνα', 'Satisfaction by survey'), subtitle: tx('Απαντήσεις 4–5 στις ερωτήσεις κλίμακας 1–5.', 'Answers of 4–5 on the 1–5 scale questions.'), rows: (q.bySurvey || []).map(([key, , answeredCount, satisfiedCount]) => [key, pct(satisfiedCount, answeredCount) ?? 0]) },
      { type: 'trend', wide: true, sparse: true, title: tx('Ικανοποίηση ανά μήνα (%)', 'Satisfaction by month (%)'), subtitle: tx('Απαντήσεις 4–5 προς όλες τις απαντήσεις κλίμακας του μήνα.', 'Answers of 4–5 over all scale answers of the month.'), points: (q.satisfactionMonthly || []).map(([key, answeredCount, satisfiedCount]) => [key, pct(satisfiedCount, answeredCount) ?? 0]) },
      { type: 'donut', title: tx('Κίνδυνοι ανά επίπεδο', 'Risks by level'), subtitle: tx('Υπολειπόμενος κίνδυνος, στην ισχύουσα εκτίμηση.', 'Residual risk, in the assessment in force.'), rows: named(q.risksByLevel), center: tx('κίνδυνοι', 'risks') },
      { type: 'bars', title: tx('Απορρίψεις αποθέματος κουζίνας', 'Kitchen stock write-offs'), subtitle: tx('Ανά αιτία, στην περίοδο.', 'By reason, in the period.'), rows: named(q.writeoffsByReason) },
    // A monthly trend needs two months at least.
    ].filter(chart => chart.type !== 'trend' || chart.points.length > 1),
  }
}
