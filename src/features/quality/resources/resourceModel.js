// Quality resources (ISO 9001 §7.1.5 and §8.4): the medical equipment and its
// maintenance and calibration programme, and the external providers with their
// certifications, yearly evaluations and nonconformities. Everything here is
// worked out from the records themselves: a device's next due dates follow from
// its last events, a supplier's approval from its latest evaluation.

import { evaluationMonths, evaluationResult, evaluationTotal } from './supplierTemplates'

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
const toneOf = (list, value) => list.find(item => item.value === value)?.tone || 'neutral'
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const DUE_SOON_DAYS = 30
export const EXPIRY_SOON_DAYS = 60

export function addMonths(day, months) {
  if (!day || !months) return ''
  const [year, month, date] = String(day).slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + Number(months), 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date, last))
  return target.toISOString().slice(0, 10)
}
export const daysBetween = (from, to) => Math.round((Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)) / 86400000)

export const CRITICALITY = [
  { value: 'high', label: ['Υψηλή', 'High'], tone: 'danger' },
  { value: 'medium', label: ['Μέτρια', 'Medium'], tone: 'warning' },
  { value: 'low', label: ['Χαμηλή', 'Low'], tone: 'neutral' },
]
export const criticalityLabel = (value, language) => pick(CRITICALITY, value, language)
export const criticalityTone = value => toneOf(CRITICALITY, value)

// --- Equipment -----------------------------------------------------------------------

// The programme a device follows: each check with its interval in months.
export const PROGRAMME = [
  { kind: 'maintenance', field: 'maintenanceMonths', label: ['Προληπτική συντήρηση', 'Preventive maintenance'] },
  { kind: 'calibration', field: 'calibrationMonths', label: ['Διακρίβωση', 'Calibration'] },
  { kind: 'safety', field: 'safetyMonths', label: ['Ηλεκτρολογικός έλεγχος ασφάλειας', 'Electrical safety test'] },
]

export const EVENT_KINDS = [
  { value: 'maintenance', label: ['Προληπτική συντήρηση', 'Preventive maintenance'], results: ['pass', 'fail'] },
  { value: 'calibration', label: ['Διακρίβωση', 'Calibration'], results: ['pass', 'fail'] },
  { value: 'safety', label: ['Έλεγχος ηλεκτρολογικής ασφάλειας', 'Electrical safety test'], results: ['pass', 'fail'] },
  { value: 'failure', label: ['Βλάβη', 'Failure'], results: ['out_of_service', 'fail'] },
  { value: 'repair', label: ['Επισκευή', 'Repair'], results: ['returned', 'fail'] },
]
export const EVENT_RESULTS = [
  { value: 'pass', label: ['Επιτυχής', 'Passed'], tone: 'success' },
  { value: 'fail', label: ['Αποτυχία / λειτουργεί με περιορισμό', 'Failed / works with limits'], tone: 'warning' },
  { value: 'out_of_service', label: ['Εκτός λειτουργίας', 'Out of service'], tone: 'danger' },
  { value: 'returned', label: ['Επανήλθε σε λειτουργία', 'Back in service'], tone: 'success' },
]
// The result of a failure that still lets the device work, and of a repair that did not fix it.
const RESULT_LABEL_FOR = { failure: { fail: ['Λειτουργεί με περιορισμό', 'Works with limits'] }, repair: { fail: ['Δεν αποκαταστάθηκε', 'Not fixed'] } }
export const eventKindLabel = (value, language) => pick(EVENT_KINDS, value, language)
export const eventResultLabel = (event, language) => RESULT_LABEL_FOR[event?.kind]?.[event?.result]?.[language === 'en' ? 1 : 0] || pick(EVENT_RESULTS, event?.result, language)
export const eventResultTone = event => (event?.kind === 'failure' && event?.result === 'fail' ? 'warning' : toneOf(EVENT_RESULTS, event?.result))
export const resultsFor = kind => EVENT_KINDS.find(item => item.value === kind)?.results || ['pass']

export const EQUIPMENT_STATES = [
  { value: 'in_service', label: ['Σε λειτουργία', 'In service'], tone: 'success' },
  { value: 'out_of_service', label: ['Εκτός λειτουργίας', 'Out of service'], tone: 'danger' },
  { value: 'retired', label: ['Αποσύρθηκε', 'Retired'], tone: 'neutral' },
]
export const equipmentStateLabel = (value, language) => pick(EQUIPMENT_STATES, value, language)
export const equipmentStateTone = value => toneOf(EQUIPMENT_STATES, value)

export const DUE_STATES = [
  { value: 'overdue', label: ['Εκπρόθεσμη', 'Overdue'], tone: 'danger' },
  { value: 'dueSoon', label: ['Σε 30 ημέρες', 'Within 30 days'], tone: 'warning' },
  { value: 'ok', label: ['Εντός προγράμματος', 'On schedule'], tone: 'success' },
  { value: 'none', label: ['Χωρίς πρόγραμμα', 'No programme'], tone: 'neutral' },
]
export const dueStateLabel = (value, language) => pick(DUE_STATES, value, language)
export const dueStateTone = value => toneOf(DUE_STATES, value)

const byDate = (a, b) => String(a.happenedOn || '').localeCompare(String(b.happenedOn || '')) || String(a.recordedAt || '').localeCompare(String(b.recordedAt || ''))

// What a result says about whether the device works: down, up, or nothing.
function serviceEffect(event) {
  if (event.kind === 'failure') return event.result === 'out_of_service' ? 'down' : null
  if (event.kind === 'repair') return event.result === 'returned' ? 'up' : 'down'
  return event.result === 'fail' ? 'down' : 'up'
}

// One programme check of a device: when it was last done, when it is due next.
// A device never checked is due from its installation (or now).
export function programmeState(equipment, events, step, today = todayIso()) {
  const months = Number(equipment?.[step.field]) || 0
  const done = events.filter(event => event.kind === step.kind && event.result === 'pass').sort(byDate)
  const last = done[done.length - 1] || null
  if (!months) return { kind: step.kind, months: 0, last, nextDue: '', state: 'none', days: null }
  const nextDue = last ? addMonths(last.happenedOn, months) : equipment.installedOn ? addMonths(equipment.installedOn, months) : today
  const days = daysBetween(today, nextDue)
  return { kind: step.kind, months, last, nextDue, state: days < 0 ? 'overdue' : days <= DUE_SOON_DAYS ? 'dueSoon' : 'ok', days }
}

// A device as the lists show it: its state, each check of its programme, the
// earliest due date, and the open failure if it is out of service.
export function equipmentStatus(equipment, events = [], today = todayIso()) {
  const own = events.filter(event => event.equipmentId === equipment.id).sort(byDate)
  const programme = PROGRAMME.map(step => programmeState(equipment, own, step, today))
  const effects = own.map(event => ({ event, effect: serviceEffect(event) })).filter(item => item.effect)
  const latest = effects[effects.length - 1]
  const down = equipment.status !== 'retired' && latest?.effect === 'down'
  const state = equipment.status === 'retired' ? 'retired' : down ? 'out_of_service' : 'in_service'
  const active = state === 'retired' ? [] : programme.filter(item => item.state !== 'none')
  const next = [...active].sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0] || null
  const due = active.some(item => item.state === 'overdue') ? 'overdue' : active.some(item => item.state === 'dueSoon') ? 'dueSoon' : active.length ? 'ok' : 'none'
  const failures = own.filter(event => event.kind === 'failure')
  return { state, programme, next, due, downSince: down ? latest.event.happenedOn : '', downEvent: down ? latest.event : null, lastEvent: own[own.length - 1] || null, failures: failures.length, warrantyActive: Boolean(equipment.warrantyEndsOn && equipment.warrantyEndsOn >= today) }
}

export function withEquipmentStatus(equipment = [], events = [], today = todayIso()) {
  return equipment.map(item => ({ ...item, ...equipmentStatus(item, events, today), eventCount: events.filter(event => event.equipmentId === item.id).length }))
}

export function equipmentCounts(rows = []) {
  const live = rows.filter(row => row.state !== 'retired')
  return {
    total: live.length,
    overdue: live.filter(row => row.due === 'overdue').length,
    dueSoon: live.filter(row => row.due === 'dueSoon').length,
    down: live.filter(row => row.state === 'out_of_service').length,
    critical: live.filter(row => row.criticality === 'high').length,
  }
}

export const NO_EQUIPMENT_FILTERS = { query: '', department: 'all', state: 'all', due: 'all', criticality: 'all', quick: null }
export function filterEquipment(rows = [], filters = NO_EQUIPMENT_FILTERS) {
  const q = String(filters.query || '').trim().toLocaleLowerCase('el')
  const quick = filters.quick
  return rows
    .filter(row => !q || [row.code, row.name, row.manufacturer, row.model, row.serialNumber, row.inventoryNumber, row.location, row.department, row.supplierName].some(value => String(value || '').toLocaleLowerCase('el').includes(q)))
    .filter(row => filters.department === 'all' || row.departmentId === filters.department)
    .filter(row => (filters.state === 'all' ? row.state !== 'retired' || quick === 'retired' : row.state === filters.state))
    .filter(row => filters.due === 'all' || row.due === filters.due)
    .filter(row => filters.criticality === 'all' || row.criticality === filters.criticality)
    .filter(row => !quick || (quick === 'overdue' ? row.due === 'overdue' : quick === 'dueSoon' ? row.due === 'dueSoon' : quick === 'down' ? row.state === 'out_of_service' : quick === 'critical' ? row.criticality === 'high' : true))
    // What needs attention first: out of service, overdue, due soon; then by the next due date.
    .sort((a, b) => rank(a) - rank(b) || String(a.next?.nextDue || '9999').localeCompare(String(b.next?.nextDue || '9999')) || String(a.code).localeCompare(String(b.code)))
}
const rank = row => (row.state === 'out_of_service' ? 0 : row.due === 'overdue' ? 1 : row.due === 'dueSoon' ? 2 : row.state === 'retired' ? 4 : 3)

export function nextCode(prefix, codes = [], width = 4) {
  const used = codes.map(code => String(code || '').match(new RegExp(`^${prefix}-(\\d+)$`))?.[1]).filter(Boolean).map(Number)
  return `${prefix}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(width, '0')}`
}
export const nextEquipmentCode = codes => nextCode('EQ', codes, 4)
export const nextSupplierCode = codes => nextCode('SUP', codes, 3)

export function newEquipment() {
  return { id: '', code: '', name: '', equipmentType: '', departmentId: '', location: '', manufacturer: '', model: '', serialNumber: '', inventoryNumber: '', supplierId: '', criticality: 'medium', status: 'in_service', installedOn: '', warrantyEndsOn: '', maintenanceMonths: 12, calibrationMonths: '', safetyMonths: 12, notes: '' }
}

export function equipmentProblems(equipment, language = 'el') {
  const en = language === 'en'
  const problems = []
  if (String(equipment.name || '').trim().length < 2) problems.push(en ? 'a name' : 'όνομα')
  for (const step of PROGRAMME) { const value = equipment[step.field]; if (value !== '' && value != null && !(Number(value) >= 1 && Number(value) <= 120)) problems.push(en ? `${step.label[1].toLowerCase()} every 1–120 months` : `${step.label[0].toLowerCase()} κάθε 1–120 μήνες`) }
  return problems
}

export function newEvent(kind = 'maintenance', today = todayIso()) {
  return { kind, happenedOn: today, result: resultsFor(kind)[0], performedBy: '', description: '', certificate: '' }
}

export function eventProblems(event, language = 'el') {
  const en = language === 'en'
  const problems = []
  if (!event.happenedOn) problems.push(en ? 'the date' : 'ημερομηνία')
  else if (event.happenedOn > todayIso()) problems.push(en ? 'a date not in the future' : 'ημερομηνία όχι μελλοντική')
  if (!resultsFor(event.kind).includes(event.result)) problems.push(en ? 'the result' : 'αποτέλεσμα')
  if (event.kind === 'failure' && !String(event.description || '').trim()) problems.push(en ? 'what happened' : 'περιγραφή της βλάβης')
  return problems
}

// --- Suppliers ------------------------------------------------------------------------

export const SUPPLIER_CATEGORIES = [
  { value: 'products', label: ['Προϊόντα (γενικές προμήθειες)', 'Products (general supplies)'] },
  { value: 'medical_devices', label: ['Ιατροτεχνολογικά προϊόντα', 'Medical devices'] },
  { value: 'consumables', label: ['Υγειονομικό υλικό / αναλώσιμα χειρουργείου', 'Medical and surgical consumables'] },
  { value: 'pharmaceuticals', label: ['Φάρμακα', 'Pharmaceuticals'] },
  { value: 'laboratory', label: ['Εργαστήριο (αντιδραστήρια, αναλώσιμα)', 'Laboratory (reagents, consumables)'] },
  { value: 'kitchen', label: ['Κουζίνα / τρόφιμα', 'Kitchen / food'] },
  { value: 'services', label: ['Υπηρεσίες / υπεργολάβοι', 'Services / subcontractors'] },
  { value: 'maintenance', label: ['Συντήρηση / τεχνική υποστήριξη', 'Maintenance / technical support'] },
  { value: 'cleaning', label: ['Καθαριότητα', 'Cleaning'] },
  { value: 'laundry', label: ['Ιματισμός / πλυντήρια', 'Linen / laundry'] },
  { value: 'waste', label: ['Διαχείριση αποβλήτων', 'Waste management'] },
  { value: 'it', label: ['Πληροφορική', 'Information technology'] },
  { value: 'certification_body', label: ['Φορέας πιστοποίησης / επιθεώρησης', 'Certification / inspection body'] },
]
// The earlier «Σίτιση» category is the kitchen.
const CATEGORY_ALIASES = { catering: 'kitchen' }
export const supplierCategoryOf = value => CATEGORY_ALIASES[value] || value
export const supplierCategoryLabel = (value, language) => pick(SUPPLIER_CATEGORIES, supplierCategoryOf(value), language)

export const SUPPLIER_STATUSES = [
  { value: 'active', label: ['Ενεργός', 'Active'] },
  { value: 'inactive', label: ['Ανενεργός', 'Inactive'] },
]

// The six fixed criteria of the earlier evaluations (before the templates), each scored 1–5.
export const CRITERIA = [
  { key: 'quality', label: ['Ποιότητα προϊόντων / υπηρεσιών', 'Quality of products / services'] },
  { key: 'delivery', label: ['Συνέπεια στους χρόνους παράδοσης', 'On-time delivery'] },
  { key: 'specs', label: ['Συμμόρφωση με τις προδιαγραφές', 'Compliance with specifications'] },
  { key: 'documents', label: ['Πιστοποιητικά και τεκμηρίωση', 'Certificates and documentation'] },
  { key: 'support', label: ['Επικοινωνία και υποστήριξη', 'Communication and support'] },
  { key: 'price', label: ['Τιμή και όροι', 'Price and terms'] },
]
export const SCORE_STEPS = [
  { value: 1, label: ['Πολύ κακή', 'Very poor'] },
  { value: 2, label: ['Κακή', 'Poor'] },
  { value: 3, label: ['Μέτρια', 'Fair'] },
  { value: 4, label: ['Καλή', 'Good'] },
  { value: 5, label: ['Άριστη', 'Excellent'] },
]
export const APPROVED_AT = 80
export const CONDITIONAL_AT = 60

export const APPROVALS = [
  { value: 'approved', label: ['Εγκεκριμένος', 'Approved'], tone: 'success' },
  { value: 'conditional', label: ['Υπό όρους', 'Conditional'], tone: 'warning' },
  { value: 'rejected', label: ['Απορρίπτεται', 'Rejected'], tone: 'danger' },
  { value: 'unevaluated', label: ['Χωρίς αξιολόγηση', 'Not evaluated'], tone: 'neutral' },
]
export const approvalLabel = (value, language) => pick(APPROVALS, value, language)
export const approvalTone = value => toneOf(APPROVALS, value)

// The evaluation's score: the points given over the points possible, as a %,
// each criterion counted by its weight (1 unless the evaluation says otherwise).
// A criterion left blank does not count.
export function evaluationScore(scores = {}, weights = {}) {
  const given = CRITERIA.map(item => ({ value: Number(scores?.[item.key]), weight: Number(weights?.[item.key]) > 0 ? Number(weights[item.key]) : 1 })).filter(item => item.value >= 1 && item.value <= 5)
  if (!given.length) return null
  const total = given.reduce((sum, item) => sum + item.weight, 0)
  return Math.round((given.reduce((sum, item) => sum + item.value * item.weight, 0) / (total * 5)) * 100)
}
export const approvalFor = score => (score == null ? 'unevaluated' : score >= APPROVED_AT ? 'approved' : score >= CONDITIONAL_AT ? 'conditional' : 'rejected')

export const NONCONFORMITY_SEVERITIES = [
  { value: 'minor', label: ['Μικρή', 'Minor'], tone: 'warning' },
  { value: 'major', label: ['Σοβαρή', 'Major'], tone: 'danger' },
]
export const severityLabel = (value, language) => pick(NONCONFORMITY_SEVERITIES, value, language)
export const severityTone = value => toneOf(NONCONFORMITY_SEVERITIES, value)

export const CERTIFICATION_TYPES = ['ISO 9001', 'ISO 13485', 'ISO 14001', 'ISO 45001', 'ISO 22000 / HACCP', 'ISO 15189 / ISO 17025', 'CE', 'CE-IVD', 'Βεβαίωση ΔΥ8δ/1348/04', 'Άδεια ΕΟΦ', 'Άδεια λειτουργίας', 'Σύμβαση', 'Δήλωση συμμόρφωσης', 'Τεχνικές προδιαγραφές', 'Άλλο']

export function certificationState(certification, today = todayIso()) {
  if (!certification?.expiresOn) return 'none'
  const days = daysBetween(today, certification.expiresOn)
  return days < 0 ? 'expired' : days <= EXPIRY_SOON_DAYS ? 'expiring' : 'valid'
}
export const CERTIFICATION_STATES = [
  { value: 'valid', label: ['Σε ισχύ', 'Valid'], tone: 'success' },
  { value: 'expiring', label: ['Λήγει σε 60 ημέρες', 'Expires within 60 days'], tone: 'warning' },
  { value: 'expired', label: ['Έληξε, χωρίς ανανέωση', 'Expired, not renewed'], tone: 'danger' },
  { value: 'none', label: ['Χωρίς λήξη', 'No expiry'], tone: 'neutral' },
]
export const certificationStateLabel = (value, language) => pick(CERTIFICATION_STATES, value, language)
export const certificationStateTone = value => toneOf(CERTIFICATION_STATES, value)

const latestOf = (items = [], field) => [...items].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')))[0] || null

// A supplier as the lists show it: its approval from the latest scored evaluation
// (else the decision recorded on the supplier), when the next evaluation is due
// (the latest one plus the frequency of the supplier or of its template), its
// certificates and open nonconformities.
const legacyScore = evaluation => evaluationScore(evaluation.scores, evaluation.weights)
export const evaluationPercent = evaluation => evaluationTotal(evaluation, legacyScore)
export const evaluationApproval = evaluation => evaluationResult(evaluation, legacyScore)

export function supplierStatus(supplier, today = todayIso(), templates = []) {
  const evaluations = supplier.evaluations || []
  const latest = latestOf(evaluations, 'evaluatedOn')
  const scored = latestOf(evaluations.filter(item => evaluationPercent(item) != null), 'evaluatedOn')
  const score = scored ? evaluationPercent(scored) : null
  const approval = scored ? evaluationApproval(scored) : supplier.approvalStatus || 'unevaluated'
  const months = evaluationMonths(supplier, latest, templates)
  const nextEvaluation = latest ? addMonths(latest.evaluatedOn, months) : ''
  const evaluationDue = supplier.status !== 'inactive' && (!latest || nextEvaluation < today)
  const certificates = (supplier.certifications || []).map(item => ({ ...item, state: certificationState(item, today) }))
  const open = (supplier.nonconformities || []).filter(item => item.status !== 'closed')
  const contractDays = supplier.contractEndsOn ? daysBetween(today, supplier.contractEndsOn) : null
  return {
    approval, score, latestEvaluation: latest, scoredEvaluation: scored, evaluationDue, evaluationMonths: months,
    nextEvaluation,
    expiredCertificates: certificates.filter(item => item.state === 'expired').length,
    expiringCertificates: certificates.filter(item => item.state === 'expiring').length,
    openNonconformities: open.length,
    majorOpen: open.filter(item => item.severity === 'major').length,
    contractState: contractDays == null ? 'none' : contractDays < 0 ? 'expired' : contractDays <= EXPIRY_SOON_DAYS ? 'expiring' : 'valid',
  }
}

export const withSupplierStatus = (suppliers = [], equipment = [], today = todayIso(), templates = []) => suppliers.map(item => ({ ...item, ...supplierStatus(item, today, templates), equipmentCount: equipment.filter(device => device.supplierId === item.id).length }))

export function supplierCounts(rows = []) {
  const live = rows.filter(row => row.status !== 'inactive')
  return {
    total: live.length,
    approved: live.filter(row => row.approval === 'approved').length,
    attention: live.filter(row => row.approval === 'conditional' || row.approval === 'rejected').length,
    evaluationDue: live.filter(row => row.evaluationDue).length,
    certificates: live.filter(row => row.expiredCertificates || row.expiringCertificates).length,
    nonconformities: live.reduce((sum, row) => sum + row.openNonconformities, 0),
  }
}

export const NO_SUPPLIER_FILTERS = { query: '', category: 'all', approval: 'all', criticality: 'all', status: 'active', quick: null }
export function filterSuppliers(rows = [], filters = NO_SUPPLIER_FILTERS) {
  const q = String(filters.query || '').trim().toLocaleLowerCase('el')
  const quick = filters.quick
  return rows
    .filter(row => !q || [row.code, row.name, row.legalName, row.taxId, row.products, row.contactName, row.city].some(value => String(value || '').toLocaleLowerCase('el').includes(q)))
    .filter(row => filters.category === 'all' || supplierCategoryOf(row.category) === filters.category)
    .filter(row => filters.approval === 'all' || row.approval === filters.approval)
    .filter(row => filters.criticality === 'all' || row.criticality === filters.criticality)
    .filter(row => filters.status === 'all' || row.status === filters.status)
    .filter(row => !quick || (quick === 'approved' ? row.approval === 'approved' : quick === 'attention' ? row.approval === 'conditional' || row.approval === 'rejected' : quick === 'evaluationDue' ? row.evaluationDue : quick === 'certificates' ? row.expiredCertificates || row.expiringCertificates : quick === 'nonconformities' ? row.openNonconformities > 0 : true))
    .sort((a, b) => supplierRank(a) - supplierRank(b) || String(a.name).localeCompare(String(b.name), 'el'))
}
const supplierRank = row => (row.approval === 'rejected' || row.majorOpen ? 0 : row.approval === 'conditional' || row.openNonconformities || row.expiredCertificates ? 1 : row.evaluationDue ? 2 : 3)

export function newSupplier() {
  return { id: '', code: '', name: '', legalName: '', category: 'products', criticality: 'medium', status: 'active', taxId: '', contactName: '', phone: '', email: '', address: '', city: '', country: '', website: '', products: '', contractEndsOn: '', approvalStatus: '', evaluationMonths: '', notes: '', certifications: [], evaluations: [], nonconformities: [], contacts: [] }
}
export function supplierProblems(supplier, language = 'el') {
  const en = language === 'en'
  const problems = []
  if (String(supplier.name || '').trim().length < 2) problems.push(en ? 'a name' : 'επωνυμία')
  if (supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email)) problems.push(en ? 'a valid email' : 'έγκυρο email')
  const months = supplier.evaluationMonths
  if (months !== '' && months != null && !(Number.isInteger(Number(months)) && Number(months) >= 1 && Number(months) <= 60)) problems.push(en ? 'an evaluation frequency of 1–60 months' : 'συχνότητα αξιολόγησης 1–60 μήνες')
  return problems
}
const itemId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
export const newEvaluation = (today = todayIso()) => ({ id: itemId('ev'), evaluatedOn: today, evaluator: '', scores: Object.fromEntries(CRITERIA.map(item => [item.key, ''])), notes: '' })
export const newCertification = () => ({ id: itemId('cert'), type: 'ISO 9001', title: '', kind: 'certificate', number: '', issuer: '', expiresOn: '' })
export const newContact = () => ({ id: itemId('contact'), fullName: '', jobTitle: '', phone: '', email: '', notes: '' })
export const DOCUMENT_KINDS = [
  { value: 'certificate', label: ['Πιστοποιητικό', 'Certificate'] },
  { value: 'licence', label: ['Άδεια / βεβαίωση', 'Licence / attestation'] },
  { value: 'contract', label: ['Σύμβαση', 'Contract'] },
  { value: 'declaration', label: ['Δήλωση συμμόρφωσης', 'Declaration of conformity'] },
  { value: 'specification', label: ['Τεχνικές προδιαγραφές', 'Specifications'] },
  { value: 'other', label: ['Άλλο έγγραφο', 'Other document'] },
]
export const documentKindLabel = (value, language) => pick(DOCUMENT_KINDS, value || 'certificate', language)
export const newNonconformity = (today = todayIso()) => ({ id: itemId('nc'), date: today, description: '', severity: 'minor', status: 'open', capaCode: '', closedOn: '' })

// --- Corrective actions ------------------------------------------------------------------

// The prefill of a corrective action opened from a failure or a supplier nonconformity.
export function equipmentCapaSource(equipment, event, language = 'el') {
  const en = language === 'en'
  const what = [equipment.name, equipment.model].filter(Boolean).join(' ')
  return {
    source: 'other', sourceId: `EQ:${equipment.code}`, departmentId: equipment.departmentId || '',
    title: en ? `Failure: ${what}` : `Βλάβη: ${what}`,
    description: [en ? `Device ${equipment.code} «${what}»${equipment.serialNumber ? `, S/N ${equipment.serialNumber}` : ''}.` : `Εξοπλισμός ${equipment.code} «${what}»${equipment.serialNumber ? `, S/N ${equipment.serialNumber}` : ''}.`, event ? `${event.happenedOn}: ${event.description || eventKindLabel(event.kind, language)}` : ''].filter(Boolean).join('\n'),
  }
}
export function supplierCapaSource(supplier, nonconformity, language = 'el') {
  const en = language === 'en'
  return {
    source: 'other', sourceId: `SUP:${supplier.code}`,
    title: en ? `Supplier nonconformity: ${supplier.name}` : `Μη συμμόρφωση προμηθευτή: ${supplier.name}`,
    description: [en ? `Supplier ${supplier.code} «${supplier.name}».` : `Προμηθευτής ${supplier.code} «${supplier.name}».`, nonconformity ? `${nonconformity.date} (${severityLabel(nonconformity.severity, language)}): ${nonconformity.description}` : ''].filter(Boolean).join('\n'),
  }
}

// --- Exports ---------------------------------------------------------------------------

export function equipmentExport(rows = [], language = 'el') {
  const en = language === 'en'
  return {
    name: en ? 'equipment' : 'eksoplismos',
    headers: en ? ['Code', 'Device', 'Type', 'Department', 'Location', 'Manufacturer', 'Model', 'Serial number', 'Inventory number', 'Supplier', 'Criticality', 'Status', 'Next check', 'Due on', 'Programme'] : ['Κωδικός', 'Εξοπλισμός', 'Τύπος', 'Τμήμα', 'Θέση', 'Κατασκευαστής', 'Μοντέλο', 'Σειριακός αριθμός', 'Αριθμός απογραφής', 'Προμηθευτής', 'Κρισιμότητα', 'Κατάσταση', 'Επόμενος έλεγχος', 'Ημερομηνία', 'Πρόγραμμα'],
    rows: rows.map(row => [row.code, row.name, row.typeLabel || row.equipmentType || '', (en ? row.departmentEn : row.department) || '', row.location || '', row.manufacturer || '', row.model || '', row.serialNumber || '', row.inventoryNumber || '', row.supplierName || '', criticalityLabel(row.criticality, language), equipmentStateLabel(row.state, language), row.next ? eventKindLabel(row.next.kind, language) : '', row.next?.nextDue || '', dueStateLabel(row.due, language)]),
  }
}

export function suppliersExport(rows = [], language = 'el') {
  const en = language === 'en'
  return {
    name: en ? 'suppliers' : 'promitheftes',
    headers: en ? ['Code', 'Supplier', 'Category', 'Tax ID', 'City', 'Criticality', 'Latest evaluation', 'Score %', 'Approval', 'Next evaluation', 'Open nonconformities', 'Expired certificates', 'Contract ends', 'Status'] : ['Κωδικός', 'Προμηθευτής', 'Κατηγορία', 'ΑΦΜ', 'Πόλη', 'Κρισιμότητα', 'Τελευταία αξιολόγηση', 'Βαθμολογία %', 'Έγκριση', 'Επόμενη αξιολόγηση', 'Ανοιχτές μη συμμορφώσεις', 'Ληγμένα πιστοποιητικά', 'Λήξη σύμβασης', 'Κατάσταση'],
    rows: rows.map(row => [row.code, row.name, supplierCategoryLabel(row.category, language), row.taxId || '', row.city || '', criticalityLabel(row.criticality, language), row.latestEvaluation?.evaluatedOn || '', row.score ?? '', approvalLabel(row.approval, language), row.nextEvaluation || '', row.openNonconformities, row.expiredCertificates, row.contractEndsOn || '', pick(SUPPLIER_STATUSES, row.status, language)]),
  }
}
