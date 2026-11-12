// The supplier evaluation sheet on the shared report layout (core/export/reportDocument.js):
// the supplier, the evaluation's template and thresholds, a table of the criteria
// with their weights, scores and weighted points, the result, the earlier
// evaluations and the signatures. Pure: returns the document description.
import { CRITERIA, SCORE_STEPS, approvalLabel, certificationState, evaluationApproval, evaluationPercent, supplierCategoryLabel } from './resourceModel'
import { evaluationSheetRows, formatPercent, isTemplateEvaluation } from './supplierTemplates'

const day = value => {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const comma = (value, language) => (language === 'en' ? String(value) : String(value).replace('.', ','))

// The criteria of an earlier (six fixed criteria) evaluation, as template-like rows.
const legacyCriteria = (evaluation, language) => CRITERIA.map((item, index) => ({ criterionId: item.key, label: item.label[language === 'en' ? 1 : 0], weight: Number(evaluation.weights?.[item.key]) > 0 ? Number(evaluation.weights[item.key]) : 1, position: index, score: evaluation.scores?.[item.key] ?? '' }))

// The thresholds as the form says them: approved from x% (y / scale), and «conditional» only when it is a band.
export function thresholdText(sheet, language = 'el') {
  const en = language === 'en'
  const scale = Number(sheet?.scoreScale) || 5
  const pass = Number(sheet?.passThreshold ?? 80), conditional = Number(sheet?.conditionalThreshold ?? 60)
  const points = comma(Math.round(pass * scale) / 100, language)
  return `${en ? 'Approved' : 'Εγκεκριμένος'} ≥ ${comma(pass, language)}% (${points} / ${scale})${conditional < pass ? ` · ${en ? 'Conditional' : 'Υπό όρους'} ≥ ${comma(conditional, language)}%` : ''}`
}

// The question of each criterion (the template's guidance), found by the criterion or its label.
const withQuestions = (criteria = [], template) => criteria.map(item => {
  const own = (template?.criteria || []).find(entry => entry.id === item.criterionId) || (template?.criteria || []).find(entry => String(entry.label).trim() === String(item.label).trim())
  return { ...item, description: item.description || own?.description || '' }
})
const templateOf = (templates = [], evaluation) => templates.find(item => item.id === evaluation?.templateId) || templates.find(item => item.name === evaluation?.templateName) || null

export function supplierEvaluationDocument(supplier, evaluation, { language = 'el', nextEvaluation = '', months = 12, templates = [] } = {}) {
  const en = language === 'en'
  const template = templateOf(templates, evaluation)
  // An evaluation without its scores per criterion prints the criteria (and questions) of its template.
  const base = evaluation && (isTemplateEvaluation(evaluation) ? evaluation : { ...evaluation, criteria: legacyCriteria(evaluation, language), scoreScale: 5 })
  const sheet = base && { ...base, criteria: withQuestions(base.criteria?.length ? base.criteria : (template?.criteria || []).map((item, index) => ({ criterionId: item.id, label: item.label, weight: item.weight, position: index, score: '' })), template) }
  const score = evaluation ? evaluationPercent(evaluation) : null
  const result = evaluation ? evaluationApproval(evaluation) : 'unevaluated'
  const scale = Number(sheet?.scoreScale) || 5
  const partial = sheet && (sheet.criteriaScores === 'partial' || sheet.criteriaScores === 'not_recorded')
  const weights = (sheet?.criteria || []).reduce((sum, item) => sum + Number(item.weight || 0), 0)
  const history = [...(supplier.evaluations || [])].sort((a, b) => String(b.evaluatedOn).localeCompare(String(a.evaluatedOn)))
  const certificates = supplier.certifications || []
  const open = (supplier.nonconformities || []).filter(item => item.status !== 'closed')
  const L = (el, enText) => (en ? enText : el)
  return {
    language,
    kind: L('Φύλλο αξιολόγησης προμηθευτή', 'Supplier evaluation sheet'),
    title: supplier.name,
    code: supplier.code,
    subtitle: sheet ? [sheet.templateName || L('Γενικά κριτήρια', 'General criteria'), sheet.templateVersion ? `${L('έκδοση', 'version')} ${sheet.templateVersion}` : ''].filter(Boolean).join(' · ') : L('Χωρίς αξιολόγηση', 'Not evaluated'),
    meta: [
      [L('Προμηθευτής', 'Supplier'), [supplier.name, supplier.legalName && supplier.legalName !== supplier.name ? `(${supplier.legalName})` : ''].filter(Boolean).join(' ')],
      [L('Κατηγορία', 'Category'), supplierCategoryLabel(supplier.category, language)],
      [L('ΑΦΜ', 'Tax ID'), supplier.taxId || '—'],
      [L('Πόλη', 'City'), supplier.city || '—'],
      [L('Ημερομηνία αξιολόγησης', 'Evaluated on'), day(evaluation?.evaluatedOn)],
      [L('Αξιολογητής', 'Evaluated by'), evaluation?.evaluator || '—'],
      [L('Κλίμακα', 'Scale'), scale === 10 ? '0–10' : '1–5'],
      [L('Όρια', 'Thresholds'), sheet ? thresholdText(sheet, language) : '—'],
      [L('Αποτέλεσμα', 'Result'), `${formatPercent(score, language)} · ${approvalLabel(result, language)}`],
      [L('Επόμενη αξιολόγηση', 'Next evaluation'), `${day(nextEvaluation)} (${L(`κάθε ${months} μήνες`, `every ${months} months`)})`],
    ],
    sections: [
      {
        title: L('Κριτήρια και βαθμολογία', 'Criteria and scores'),
        table: {
          // Each criterion with the question it is scored on under it.
          columns: [{ text: '#', width: '5%' }, { text: L('Κριτήριο / ερώτηση', 'Criterion / question'), width: '55%' }, { text: L('Βάρος', 'Weight'), align: 'right', width: '10%' }, { text: L('Βαθμός', 'Score'), align: 'right', width: '14%' }, { text: L('Σταθμισμένοι πόντοι', 'Weighted points'), align: 'right', width: '16%' }],
          rows: sheet ? evaluationSheetRows(sheet, language).map((row, index) => [row[0], sheet.criteria[index]?.description ? `${row[1]} — ${sheet.criteria[index].description}` : row[1], { text: row[2], align: 'right' }, { text: row[3], align: 'right' }, { text: row[4], align: 'right' }]) : [],
          foot: sheet ? ['', L('Σύνολο', 'Total'), { text: comma(Math.round(weights * 1000) / 1000, language), align: 'right' }, '', { text: formatPercent(score, language), align: 'right' }] : null,
          empty: L('Δεν υπάρχει αξιολόγηση.', 'No evaluation yet.'),
        },
        note: partial ? L('Καταγράφηκε η συνολική βαθμολογία και μόνο ο βαθμός του πρώτου κριτηρίου· τα υπόλοιπα κριτήρια δεν καταγράφηκαν ανά κριτήριο. Το αποτέλεσμα είναι η συνολική βαθμολογία.', 'Only the total and the first criterion\'s score were recorded; the other criteria were not recorded one by one. The result is the total score.') : `${L('Αποτέλεσμα', 'Result')} = Σ (${L('βαθμός', 'score')} / ${scale} × ${L('βάρος', 'weight')}) / Σ ${L('βάρος', 'weight')} × 100.`,
      },
      { title: L('Παρατηρήσεις', 'Remarks'), text: evaluation?.notes || '—' },
      {
        title: L('Ιστορικό αξιολογήσεων', 'Evaluation history'),
        table: {
          columns: [L('Ημερομηνία', 'Date'), L('Πρότυπο', 'Template'), { text: L('Βαθμολογία', 'Score'), align: 'right' }, L('Αποτέλεσμα', 'Result')],
          rows: history.map(item => [day(item.evaluatedOn), item.templateName || L('Γενικά κριτήρια', 'General criteria'), { text: formatPercent(evaluationPercent(item), language), align: 'right' }, approvalLabel(evaluationApproval(item), language)]),
        },
      },
      {
        title: L('Πιστοποιητικά και μη συμμορφώσεις', 'Certificates and nonconformities'),
        facts: [
          [L('Πιστοποιητικά / έγγραφα', 'Certificates / documents'), String(certificates.length)],
          [L('Σε ισχύ', 'Valid'), String(certificates.filter(item => ['valid', 'expiring', 'none'].includes(certificationState(item))).length)],
          [L('Ληγμένα', 'Expired'), String(certificates.filter(item => certificationState(item) === 'expired').length)],
          [L('Ανοιχτές μη συμμορφώσεις', 'Open nonconformities'), String(open.length)],
        ],
      },
    ],
    signatures: [L('Αξιολογητής', 'Evaluator'), L('Υπεύθυνος Ποιότητας', 'Quality manager')],
    filename: `${supplier.code}_${en ? 'evaluation' : 'axiologisi'}_${evaluation?.evaluatedOn || ''}`,
  }
}

// All the suppliers' evaluations on one sheet, as the hospital's form «Αξιολόγηση εξωτερικών παρόχων»: per template,
// its criteria and questions once, then a line per supplier with the score of each criterion, the mean, the result.
export function supplierEvaluationsSheet(suppliers = [], templates = [], { language = 'el', title } = {}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const latest = supplier => [...(supplier.evaluations || [])].sort((a, b) => String(b.evaluatedOn).localeCompare(String(a.evaluatedOn)))[0] || null
  const groups = new Map()
  for (const supplier of suppliers) {
    const evaluation = latest(supplier)
    const template = templateOf(templates, evaluation) || templates.find(item => (item.categories || []).includes(supplier.category)) || null
    const key = template?.id || 'none'
    if (!groups.has(key)) groups.set(key, { template, rows: [] })
    groups.get(key).rows.push({ supplier, evaluation })
  }
  const scale = 5
  const legend = SCORE_STEPS.map(step => `${step.value} = ${step.label[en ? 1 : 0]}`).join(' · ')
  const sections = []
  for (const { template, rows } of [...groups.values()].sort((a, b) => String(a.template?.name || 'ω').localeCompare(String(b.template?.name || 'ω'), 'el'))) {
    const criteria = template?.criteria || []
    sections.push({
      title: `${template?.name || L('Χωρίς πρότυπο', 'No template')} · ${rows.length}`,
      text: criteria.map((item, index) => `${index + 1}. ${item.label}${item.description ? ` — ${item.description}` : ''}${item.optional ? L(' (προαιρετικό)', ' (optional)') : ''}`).join('\n'),
      note: template ? thresholdText({ ...template, scoreScale: template.scoreScale || scale }, language) : '',
      table: {
        columns: [{ text: L('Προμηθευτής', 'Supplier'), width: '22%' }, { text: L('Ημερομηνία', 'Date'), width: '9%', align: 'center' },
          ...criteria.map((_, index) => ({ text: String(index + 1), align: 'center' })),
          { text: L('Μέση βαθμολογία', 'Mean score'), align: 'center', width: '9%' }, { text: L('Εγκεκριμένος', 'Approved'), width: '10%' }],
        rows: rows.sort((a, b) => String(a.supplier.name).localeCompare(String(b.supplier.name), 'el')).map(({ supplier, evaluation }) => {
          const percent = evaluation ? evaluationPercent(evaluation) : null
          const byCriterion = criterion => (evaluation?.criteria || []).find(item => item.criterionId === criterion.id || String(item.label).trim() === String(criterion.label).trim())
          return [supplier.name, { text: day(evaluation?.evaluatedOn), align: 'center' },
            ...criteria.map(criterion => { const value = byCriterion(criterion)?.score; return { text: value === '' || value == null ? '' : String(value), align: 'center' } }),
            { text: percent == null ? '—' : comma(Math.round(percent * scale) / 100, language), align: 'center' },
            evaluation ? approvalLabel(evaluationApproval(evaluation), language) : L('Δεν αξιολογήθηκε', 'Not evaluated')]
        }),
      },
    })
  }
  return {
    language,
    orientation: 'landscape',
    kind: L('Αξιολόγηση εξωτερικών παρόχων', 'External providers evaluation'),
    title: title || L('Αξιολόγηση προμηθευτών', 'Supplier evaluation'),
    meta: [[L('Κλίμακα αξιολόγησης', 'Scale'), legend], [L('Προμηθευτές', 'Suppliers'), String(suppliers.length)]],
    sections,
    signatures: [L('Υπεύθυνοι αξιολόγησης', 'Evaluated by'), L('Υπεύθυνος Ποιότητας', 'Quality manager')],
    filename: en ? 'supplier-evaluation' : 'axiologisi-promitheftwn',
  }
}
