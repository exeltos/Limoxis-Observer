// Supplier evaluation templates (20261122100000_quality_supplier_eval_templates.sql):
// each supplier category has its own weighted criteria, approval thresholds and
// evaluation frequency. An evaluation keeps a snapshot of its template (name,
// version, thresholds, scale, and each criterion's label and weight as scored),
// so a later edit of the template does not change it. Pure functions.

export const SCALES = [5, 10]
export const DEFAULT_PASS = 80
export const DEFAULT_CONDITIONAL = 60
export const DEFAULT_FREQUENCY = 12

export const RESULTS = [
  { value: 'approved', label: ['Εγκεκριμένος', 'Approved'], tone: 'success' },
  { value: 'conditional', label: ['Υπό όρους', 'Conditional'], tone: 'warning' },
  { value: 'rejected', label: ['Απορρίπτεται', 'Rejected'], tone: 'danger' },
]

const itemId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const text = value => String(value ?? '').trim()
const number = value => (value === '' || value == null ? NaN : Number(value))
const round1 = value => Math.round(value * 10) / 10

export function newCriterion(label = '', weight = 1) {
  return { id: itemId('crit'), label, description: '', weight }
}

export function newTemplate(categories = []) {
  return { id: '', name: '', description: '', categories, passThreshold: DEFAULT_PASS, conditionalThreshold: DEFAULT_CONDITIONAL, frequencyMonths: DEFAULT_FREQUENCY, scoreScale: 5, active: true, version: 1, criteria: [newCriterion()] }
}

export const weightTotal = (criteria = []) => round1(criteria.reduce((sum, item) => sum + (Number(item.weight) > 0 ? Number(item.weight) : 0), 0) * 100) / 100

// What a template needs before it is saved.
export function templateProblems(template, language = 'el') {
  const en = language === 'en'
  const problems = []
  if (text(template?.name).length < 2) problems.push(en ? 'a name' : 'όνομα')
  const criteria = template?.criteria || []
  if (!criteria.length) problems.push(en ? 'at least one criterion' : 'τουλάχιστον ένα κριτήριο')
  if (criteria.some(item => !text(item.label))) problems.push(en ? 'a label for each criterion' : 'περιγραφή σε κάθε κριτήριο')
  if (criteria.some(item => !(number(item.weight) > 0))) problems.push(en ? 'a weight above 0 for each criterion' : 'βάρος πάνω από 0 σε κάθε κριτήριο')
  const pass = number(template?.passThreshold), conditional = number(template?.conditionalThreshold)
  if (!(pass >= 0 && pass <= 100) || !(conditional >= 0 && conditional <= 100)) problems.push(en ? 'thresholds between 0 and 100%' : 'όρια από 0 έως 100%')
  else if (conditional > pass) problems.push(en ? 'a conditional threshold not above the approval one' : 'όριο «υπό όρους» όχι πάνω από το όριο έγκρισης')
  const months = number(template?.frequencyMonths)
  if (!(Number.isInteger(months) && months >= 1 && months <= 60)) problems.push(en ? 'a frequency of 1–60 months' : 'συχνότητα 1–60 μήνες')
  return problems
}

// Moves a criterion up (-1) or down (+1); the list keeps its other order.
export function moveCriterion(criteria = [], index, delta) {
  const target = index + delta
  if (index < 0 || index >= criteria.length || target < 0 || target >= criteria.length) return criteria
  const next = [...criteria]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

// The active templates that apply to a category, by name; a template with no
// category applies to every supplier.
export function templatesFor(templates = [], category) {
  const active = templates.filter(item => item.active !== false)
  const own = active.filter(item => (item.categories || []).includes(category))
  const general = active.filter(item => !(item.categories || []).length)
  return [...own, ...general].sort((a, b) => Number(!(a.categories || []).includes(category)) - Number(!(b.categories || []).includes(category)) || String(a.name).localeCompare(String(b.name), 'el'))
}
export const templateFor = (templates = [], category) => templatesFor(templates, category)[0] || null

// The weighted result as % of the scale: Σ(score / scale × weight) / Σ(weight of
// the scored criteria). A criterion not scored does not count; nothing scored: null.
export function weightedScore(criteria = [], scale = 5) {
  const max = Number(scale) || 5
  const scored = criteria.map(item => ({ score: number(item.score), weight: Number(item.weight) > 0 ? Number(item.weight) : 0 })).filter(item => item.weight > 0 && item.score >= 0 && item.score <= max)
  if (!scored.length) return null
  const weights = scored.reduce((sum, item) => sum + item.weight, 0)
  return round1((scored.reduce((sum, item) => sum + (item.score / max) * item.weight, 0) / weights) * 100)
}

export function resultFor(score, pass = DEFAULT_PASS, conditional = DEFAULT_CONDITIONAL) {
  if (score == null || Number.isNaN(Number(score))) return 'unevaluated'
  const value = Number(score)
  return value >= Number(pass ?? DEFAULT_PASS) ? 'approved' : value >= Number(conditional ?? DEFAULT_CONDITIONAL) ? 'conditional' : 'rejected'
}

// A new evaluation on a template: the template's snapshot and one empty score per criterion.
export function evaluationFromTemplate(template, today = new Date().toISOString().slice(0, 10)) {
  const evaluation = { id: itemId('ev'), evaluatedOn: today, evaluator: '', notes: '', source: 'app' }
  return template ? applyTemplate(evaluation, template) : { ...evaluation, scores: {}, criteria: [] }
}

// Puts an evaluation on a (different) template; a criterion of the same template keeps its score.
export function applyTemplate(evaluation, template) {
  const before = new Map((evaluation.criteria || []).map(item => [item.criterionId, item.score]))
  return {
    ...evaluation,
    templateId: template.id, templateName: template.name, templateVersion: template.version || 1,
    passThreshold: Number(template.passThreshold ?? DEFAULT_PASS), conditionalThreshold: Number(template.conditionalThreshold ?? DEFAULT_CONDITIONAL),
    scoreScale: Number(template.scoreScale) || 5, frequencyMonths: Number(template.frequencyMonths) || DEFAULT_FREQUENCY,
    criteria: (template.criteria || []).map((item, index) => ({ id: '', criterionId: item.id, label: item.label, description: item.description || '', weight: Number(item.weight) || 1, position: index, score: before.get(item.id) ?? '' })),
    criteriaScores: 'complete',
  }
}

export const isTemplateEvaluation = evaluation => Boolean(evaluation?.templateId || evaluation?.templateName || evaluation?.criteria?.length)
export const everyCriterionScored = evaluation => (evaluation?.criteria || []).length > 0 && evaluation.criteria.every(item => number(item.score) >= (Number(evaluation.scoreScale) === 10 ? 0 : 1))

// An evaluation's result in %: worked out from its criteria while they are all
// recorded; else the total it keeps (FileMaker kept the total and only the first
// criterion). The earlier six-criterion evaluations go through `legacy`.
export function evaluationTotal(evaluation, legacy = () => null) {
  if (!evaluation) return null
  if (isTemplateEvaluation(evaluation)) {
    if ((evaluation.criteriaScores || 'complete') === 'complete') {
      const computed = weightedScore(evaluation.criteria, evaluation.scoreScale)
      if (computed != null) return computed
    }
    return evaluation.totalScore === '' || evaluation.totalScore == null ? null : Number(evaluation.totalScore)
  }
  return legacy(evaluation)
}

export function evaluationResult(evaluation, legacy) {
  const score = evaluationTotal(evaluation, legacy)
  return resultFor(score, evaluation?.passThreshold ?? DEFAULT_PASS, evaluation?.conditionalThreshold ?? DEFAULT_CONDITIONAL)
}

// When the supplier is evaluated next: the latest evaluation plus the supplier's own
// frequency, else its template's, else the category's template's, else 12 months.
export function evaluationMonths(supplier, latest, templates = []) {
  const own = Number(supplier?.evaluationMonths)
  if (own >= 1) return own
  const used = latest?.templateId ? templates.find(item => item.id === latest.templateId) : null
  return Number(used?.frequencyMonths) || Number(latest?.frequencyMonths) || Number(templateFor(templates, supplier?.category)?.frequencyMonths) || DEFAULT_FREQUENCY
}

// The defaults of a hospital without templates, and of the demo: the three FileMaker
// templates of the hospital that started the module (products, services /
// subcontractors, kitchen) and one for the laboratory built on the products one.
export const TEMPLATE_PRESETS = [
  {
    key: 'products', name: 'Προμηθευτής Προϊόντων', categories: ['products', 'medical_devices', 'consumables', 'pharmaceuticals'], pass: 70, conditional: 50,
    criteria: [['Ποιότητα προϊόντων', 0.2], ['Συνέπεια στους χρόνους παράδοσης', 0.2], ['Συμμόρφωση με τις προδιαγραφές της παραγγελίας', 0.2], ['Πιστοποιητικά και τεκμηρίωση (CE, ISO, δηλώσεις συμμόρφωσης)', 0.15], ['Εξυπηρέτηση και διαχείριση παραπόνων', 0.15], ['Τιμή και όροι πληρωμής', 0.1]],
  },
  {
    key: 'services', name: 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', categories: ['services', 'maintenance', 'cleaning', 'laundry', 'waste', 'it', 'certification_body'], pass: 70, conditional: 50,
    criteria: [['Ποιότητα παρεχόμενων υπηρεσιών', 0.2], ['Τήρηση χρονοδιαγράμματος και ανταπόκριση', 0.2], ['Επάρκεια και εκπαίδευση προσωπικού', 0.2], ['Συμμόρφωση με νομοθεσία, ασφάλεια και τεκμηρίωση', 0.15], ['Επικοινωνία και αναφορές', 0.15], ['Κόστος', 0.1]],
  },
  {
    key: 'kitchen', name: 'Προμηθευτής Κουζίνας', categories: ['kitchen'], pass: 70, conditional: 50,
    criteria: [['Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών', 0.12], ['Ασφάλεια τροφίμων (HACCP / ISO 22000, άδειες)', 0.16], ['Θερμοκρασία και συνθήκες μεταφοράς', 0.14], ['Υγιεινή οχήματος και προσωπικού παράδοσης', 0.12], ['Επισήμανση, ιχνηλασιμότητα και ημερομηνίες λήξης', 0.12], ['Συνέπεια στους χρόνους παράδοσης', 0.12], ['Πληρότητα παραγγελίας', 0.12], ['Τιμή', 0.1]],
  },
  {
    key: 'laboratory', name: 'Προμηθευτής Εργαστηρίου', categories: ['laboratory'], pass: 70, conditional: 50,
    criteria: [['Ποιότητα προϊόντων (αντιδραστήρια, αναλώσιμα)', 0.2], ['Πιστοποίηση: CE-IVD / ISO 13485, ISO 15189 όπου απαιτείται', 0.15], ['Ποιοτικός έλεγχος παρτίδας (πιστοποιητικά ανάλυσης, εξωτερικός έλεγχος)', 0.15], ['Ψυχρή αλυσίδα κατά τη μεταφορά και αποθήκευση', 0.15], ['Τεχνική και επιστημονική υποστήριξη αναλυτών', 0.15], ['Συνέπεια στους χρόνους παράδοσης', 0.1], ['Τιμή και όροι', 0.1]],
  },
]

export function presetTemplates(prefix = 'tpl') {
  return TEMPLATE_PRESETS.map(preset => ({
    id: `${prefix}-${preset.key}`, name: preset.name, description: '', categories: preset.categories, passThreshold: preset.pass, conditionalThreshold: preset.conditional, frequencyMonths: 12, scoreScale: 5, active: true, version: 1,
    criteria: preset.criteria.map(([label, weight], index) => ({ id: `${prefix}-${preset.key}-${index + 1}`, label, description: '', weight })),
  }))
}

// The evaluation sheet: the template's criteria with their scores and the result.
export function evaluationSheetRows(evaluation, language = 'el') {
  const en = language === 'en'
  const scale = Number(evaluation?.scoreScale) || 5
  return (evaluation?.criteria || []).map((item, index) => {
    const score = number(item.score)
    const recorded = score >= 0 && score <= scale && item.score !== '' && item.score != null
    return [String(index + 1), item.label, String(item.weight).replace('.', en ? '.' : ','), recorded ? `${score} / ${scale}` : en ? 'not recorded' : 'δεν καταγράφηκε', recorded ? String(Math.round((score / scale) * Number(item.weight) * 1000) / 1000).replace('.', en ? '.' : ',') : '—']
  })
}

// 76.5 → «76,5%» (Greek) or "76.5%".
export const formatPercent = (score, language = 'el') => (score == null || score === '' || Number.isNaN(Number(score)) ? '—' : `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(Number(score))}%`)
