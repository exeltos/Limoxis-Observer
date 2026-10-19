// The supplier evaluation sheet on the shared report layout (core/export/reportDocument.js):
// the supplier, the evaluation's template and thresholds, a table of the criteria
// with their weights, scores and weighted points, the result, the earlier
// evaluations and the signatures. Pure: returns the document description.
import { CRITERIA, approvalLabel, certificationState, evaluationApproval, evaluationPercent, supplierCategoryLabel } from './resourceModel'
import { evaluationSheetRows, formatPercent, isTemplateEvaluation } from './supplierTemplates'

const day = value => {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const comma = (value, language) => (language === 'en' ? String(value) : String(value).replace('.', ','))

// The criteria of an earlier (six fixed criteria) evaluation, as template-like rows.
const legacyCriteria = (evaluation, language) => CRITERIA.map((item, index) => ({ criterionId: item.key, label: item.label[language === 'en' ? 1 : 0], weight: Number(evaluation.weights?.[item.key]) > 0 ? Number(evaluation.weights[item.key]) : 1, position: index, score: evaluation.scores?.[item.key] ?? '' }))

export function supplierEvaluationDocument(supplier, evaluation, { language = 'el', nextEvaluation = '', months = 12 } = {}) {
  const en = language === 'en'
  const sheet = evaluation && (isTemplateEvaluation(evaluation) ? evaluation : { ...evaluation, criteria: legacyCriteria(evaluation, language), scoreScale: 5 })
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
      [L('Όρια', 'Thresholds'), sheet ? `${L('Έγκριση', 'Approval')} ≥ ${comma(sheet.passThreshold ?? 80, language)}% · ${L('Υπό όρους', 'Conditional')} ≥ ${comma(sheet.conditionalThreshold ?? 60, language)}%` : '—'],
      [L('Αποτέλεσμα', 'Result'), `${formatPercent(score, language)} · ${approvalLabel(result, language)}`],
      [L('Επόμενη αξιολόγηση', 'Next evaluation'), `${day(nextEvaluation)} (${L(`κάθε ${months} μήνες`, `every ${months} months`)})`],
    ],
    sections: [
      {
        title: L('Κριτήρια και βαθμολογία', 'Criteria and scores'),
        table: {
          columns: ['#', L('Κριτήριο', 'Criterion'), { text: L('Βάρος', 'Weight'), align: 'right' }, { text: L('Βαθμός', 'Score'), align: 'right' }, { text: L('Σταθμισμένοι πόντοι', 'Weighted points'), align: 'right' }],
          rows: sheet ? evaluationSheetRows(sheet, language).map(row => [row[0], row[1], { text: row[2], align: 'right' }, { text: row[3], align: 'right' }, { text: row[4], align: 'right' }]) : [],
          foot: sheet ? ['', L('Σύνολο', 'Total'), { text: comma(Math.round(weights * 1000) / 1000, language), align: 'right' }, '', { text: formatPercent(score, language), align: 'right' }] : null,
          empty: L('Δεν υπάρχει αξιολόγηση.', 'No evaluation yet.'),
        },
        note: partial ? L('Από το FileMaker μεταφέρθηκε η συνολική βαθμολογία και μόνο ο βαθμός του πρώτου κριτηρίου· τα υπόλοιπα κριτήρια δεν καταγράφηκαν ανά κριτήριο. Το αποτέλεσμα είναι το σύνολο του FileMaker.', 'FileMaker kept the total and only the first criterion\'s score; the other criteria were not recorded one by one. The result is the FileMaker total.') : `${L('Αποτέλεσμα', 'Result')} = Σ (${L('βαθμός', 'score')} / ${scale} × ${L('βάρος', 'weight')}) / Σ ${L('βάρος', 'weight')} × 100.`,
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
          [L('Σε ισχύ', 'Valid'), String(certificates.filter(item => certificationState(item) === 'valid').length)],
          [L('Ληγμένα', 'Expired'), String(certificates.filter(item => certificationState(item) === 'expired').length)],
          [L('Ανοιχτές μη συμμορφώσεις', 'Open nonconformities'), String(open.length)],
        ],
      },
    ],
    signatures: [L('Αξιολογητής', 'Evaluator'), L('Υπεύθυνος Ποιότητας', 'Quality manager')],
    filename: `${supplier.code}_${en ? 'evaluation' : 'axiologisi'}_${evaluation?.evaluatedOn || ''}`,
  }
}
