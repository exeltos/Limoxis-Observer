import { SYSTEM_TEMPLATES } from './seed/index.js'
import { questionsForAudit } from './auditModel'

// The demo's audit programme for the year: audits on the six standards across
// the wards, done, under way and planned, with their teams, meetings, answers,
// the findings their answers became and a CAPA. The database demo has the same
// story (20261124100100_quality_audit_programme_demo.sql).

const template = key => SYSTEM_TEMPLATES.find(item => item.key === key)
const DEPT_EN = { ΜΕΘ: 'ICU', Παθολογική: 'Internal Medicine', Χειρουργική: 'Surgery', ΤΕΠ: 'ED', Καρδιολογική: 'Cardiology', Εργαστήριο: 'Laboratory', '': '' }
const lead = { id: 'tm-lead', role: 'lead', employeeId: 'EMP-008', name: 'Σταθάτου Δήμητρα', external: false, department: 'Ποιότητα' }
const member = (id, employeeId, name, department) => ({ id, role: 'member', employeeId, name, external: false, department })
const external = (id, name, affiliation, role = 'member') => ({ id, role, employeeId: null, name, external: true, affiliation })

// Every answer is «Συμμορφώνεται» except the few the story is about (by clause),
// and one in every fifteen is «Δεν εφαρμόζεται».
// An override names a clause («7.5.3») or its n-th question («IPSG.3#2»).
function answered(rows, overrides = {}, { unanswered = 0 } = {}) {
  const seen = {}
  return rows.map((row, index) => {
    seen[row.clauseRef] = (seen[row.clauseRef] || 0) + 1
    const key = [`${row.clauseRef}#${seen[row.clauseRef]}`, seen[row.clauseRef] === 1 ? row.clauseRef : null].find(ref => ref && overrides[ref])
    if (key) return { ...row, ...overrides[key] }
    if (unanswered && index >= rows.length - unanswered) return row
    return { ...row, answer: index % 15 === 14 ? 'na' : 'yes' }
  })
}

function audit(code, { key, department = '', title, titleEn, type = 'internal', planned, completed = null, status, scope = [], team = [], risk = 'medium', monthOnly = false, overrides = {}, unanswered = 0, opening = null, closing = null, conclusion = '', representative = '', followUpOf = '' }) {
  const questionnaire = template(key)
  const rows = status === 'planned' ? [] : answered(questionsForAudit(questionnaire, { department, scope }), overrides, { unanswered })
  const leadMember = team.find(item => item.role === 'lead')
  return {
    id: code, title, titleEn, department, departmentEn: DEPT_EN[department] ?? department, departmentId: '', auditType: type,
    plannedDate: planned, completedDate: completed, status, leadAuditor: leadMember?.name || '', leadAuditorId: null,
    scope: questionnaire.scope, scopeEn: questionnaire.scope, findingIds: [], attachments: [],
    history: [{ at: `${planned}T09:00:00+03:00`, action: 'recordCreated', actor: 'Υπεύθυνος Ποιότητας' }, ...(completed ? [{ at: `${completed}T15:00:00+03:00`, action: 'auditCompleted', actor: leadMember?.name || '' }] : [])],
    checklist: rows, checklistSource: `template:${questionnaire.id}`,
    templateId: questionnaire.id, templateTitle: questionnaire.title, templateVersion: questionnaire.version, standard: questionnaire.standard,
    clausesScope: scope, plannedMonthOnly: monthOnly, riskLevel: risk, frequencyMonths: { high: 6, medium: 12, low: 24 }[risk],
    openingMeeting: opening || { date: '', attendees: '' }, closingMeeting: closing || { date: '', attendees: '' },
    auditeeRepresentative: representative, conclusion, followUpOf, origin: 'seed', team,
  }
}

const nc = (answer, findingClass, note, evidence, findingId) => ({ answer, findingClass, note, evidence, ...(findingId ? { findingId } : {}) })

export const programmeAudits = [
  audit('AUD-2511-100', { key: 'iso9001', department: 'ΜΕΘ', title: 'Εσωτερική επιθεώρηση ISO 9001 — ΜΕΘ', titleEn: 'ISO 9001 internal audit — ICU', planned: '2025-11-12', completed: '2025-11-12', status: 'completed', team: [lead], risk: 'high',
    opening: { date: '2025-11-12', attendees: 'Διευθυντής ΜΕΘ, Προϊσταμένη ΜΕΘ, Σταθάτου Δήμητρα' }, closing: { date: '2025-11-12', attendees: 'Διευθυντής ΜΕΘ, Προϊσταμένη ΜΕΘ' },
    overrides: { '7.1.5': nc('partial', 'observation', 'Δύο θερμόμετρα ψυγείων χωρίς ετικέτα διακρίβωσης', 'Ψυγεία φαρμάκων 1 και 3') }, conclusion: 'Το σύστημα εφαρμόζεται αποτελεσματικά· μία παρατήρηση.' }),
  audit('AUD-2603-101', { key: 'iso9001', department: 'Παθολογική', title: 'Εσωτερική επιθεώρηση ISO 9001 — Παθολογική', titleEn: 'ISO 9001 internal audit — Internal Medicine', planned: '2026-03-18', completed: '2026-03-18', status: 'completed',
    team: [lead, member('tm-2', 'EMP-006', 'Οικονόμου Σοφία', 'Καρδιολογική')], risk: 'medium', representative: 'Δημητρίου Νικόλαος',
    opening: { date: '2026-03-18', attendees: 'Δημητρίου Νικόλαος, Προϊσταμένη Παθολογικής, Σταθάτου Δήμητρα, Οικονόμου Σοφία' }, closing: { date: '2026-03-18', attendees: 'Δημητρίου Νικόλαος, Προϊσταμένη Παθολογικής' },
    overrides: {
      '7.5.3': nc('no', 'minor', 'Στον σταθμό βρέθηκαν δύο εκδόσεις του εντύπου νοσηλευτικής λογοδοσίας (2023 και 2025)', 'Φάκελος εντύπων σταθμού', 'FND-2603-101'),
      '9.1.2': nc('partial', 'observation', 'Οι έρευνες ικανοποίησης συλλέγονται αλλά δεν συζητούνται στις συναντήσεις του τμήματος', 'Πρακτικά συναντήσεων Ιαν–Μαρ', 'FND-2603-102'),
    }, conclusion: 'Ικανοποιητική εφαρμογή· μία έλασσον μη συμμόρφωση στον έλεγχο εγγράφων.' }),
  audit('AUD-2605-102', { key: 'iso15224', department: 'Χειρουργική', title: 'Επιθεώρηση ISO 15224 — Χειρουργική', titleEn: 'ISO 15224 audit — Surgery', planned: '2026-05-21', completed: '2026-05-21', status: 'completed',
    team: [lead, external('tm-3', 'Λαμπρόπουλος Παύλος', 'Σύμβουλος ποιότητας')], risk: 'high', representative: 'Κωνσταντίνου Ελένη',
    opening: { date: '2026-05-21', attendees: 'Κωνσταντίνου Ελένη, Διευθυντής Χειρουργικής, Σταθάτου Δήμητρα, Λαμπρόπουλος Παύλος' }, closing: { date: '2026-05-21', attendees: 'Κωνσταντίνου Ελένη, Διευθυντής Χειρουργικής' },
    overrides: {
      'ΧΠ-3#2': nc('partial', 'minor', 'Σε 3 από 10 εξόδους δεν έγινε συμφιλίωση φαρμάκων', 'Φάκελοι εξόδου Απριλίου', 'FND-2605-103'),
      '8.5.1#2': nc('partial', 'opportunity', 'Η παράδοση βάρδιας γίνεται προφορικά χωρίς δομημένο εργαλείο', 'Παρατήρηση πρωινής παράδοσης', 'FND-2605-104'),
    }, conclusion: 'Καλή κλινική διακυβέρνηση· χρειάζεται βελτίωση στη συνέχεια της φροντίδας κατά την έξοδο.' }),
  audit('AUD-2607-103', { key: 'temos', department: '', title: 'Επιθεώρηση TEMOS — Γραφείο διεθνών ασθενών', titleEn: 'TEMOS audit — International patient office', planned: '2026-07-08', completed: '2026-07-08', status: 'completed',
    team: [lead], risk: 'low', representative: 'Υπεύθυνη Γραφείου Διεθνών Ασθενών',
    opening: { date: '2026-07-08', attendees: 'Υπεύθυνη Γραφείου Διεθνών Ασθενών, Σταθάτου Δήμητρα' }, closing: { date: '2026-07-08', attendees: 'Υπεύθυνη Γραφείου Διεθνών Ασθενών, Ιατρικός Διευθυντής' },
    overrides: { 'T2.3': nc('partial', 'minor', 'Το σημείωμα εξόδου δίνεται μόνο στα ελληνικά και αγγλικά', 'Δείγμα 5 φακέλων διεθνών ασθενών', 'FND-2607-105') }, conclusion: 'Η υπηρεσία λειτουργεί οργανωμένα· η μετάφραση των εγγράφων εξόδου θέλει επέκταση.' }),
  audit('AUD-2609-104', { key: 'jci', department: 'ΜΕΘ', title: 'Επιθεώρηση JCI — ΜΕΘ (IPSG, COP, MMU, PCI)', titleEn: 'JCI audit — ICU (IPSG, COP, MMU, PCI)', planned: '2026-09-24', completed: '2026-09-24', status: 'completed',
    scope: ['IPSG', 'COP', 'MMU', 'PCI'], team: [lead, member('tm-4', 'EMP-002', 'Δημητρίου Νικόλαος', 'Παθολογική'), external('tm-5', 'Σταυρίδης Λάμπρος', 'JCI consultant', 'expert')], risk: 'high', representative: 'Παπαδοπούλου Μαρία',
    opening: { date: '2026-09-24', attendees: 'Διευθυντής ΜΕΘ, Παπαδοπούλου Μαρία, Φαρμακοποιός, Σταθάτου Δήμητρα, Δημητρίου Νικόλαος, Σταυρίδης Λάμπρος' }, closing: { date: '2026-09-25', attendees: 'Διευθυντής ΜΕΘ, Παπαδοπούλου Μαρία, Ιατρικός Διευθυντής' },
    overrides: {
      'IPSG.3#2': nc('no', 'major', 'Πυκνό KCl σε ανοιχτό ερμάριο του θαλάμου 2, χωρίς σήμανση υψηλού κινδύνου', 'Ερμάριο φαρμάκων θαλάμου 2, φωτογραφία', 'FND-2609-106'),
      'IPSG.2': nc('partial', 'minor', 'Δύο τηλεφωνικές οδηγίες χωρίς τεκμηρίωση read-back', 'Φύλλα οδηγιών 21–23/09', 'FND-2609-107'),
      'PCI.8': nc('partial', 'observation', 'Ελλιπής σήμανση απομόνωσης επαφής σε έναν θάλαμο', 'Θάλαμος 5', 'FND-2609-108'),
      'MMU.6': nc('yes', 'opportunity', 'Προτείνεται σάρωση barcode κατά τη χορήγηση', 'Παρατήρηση χορήγησης', 'FND-2609-109'),
    }, conclusion: 'Ένα μείζον εύρημα στη φύλαξη πυκνών ηλεκτρολυτών· απαιτείται άμεση διορθωτική ενέργεια και επαναληπτική επιθεώρηση.' }),
  audit('AUD-2610-105', { key: 'iso9001', department: 'ΤΕΠ', title: 'Εσωτερική επιθεώρηση ISO 9001 — ΤΕΠ', titleEn: 'ISO 9001 internal audit — ED', planned: '2026-10-15', status: 'inProgress',
    team: [lead, member('tm-6', 'EMP-006', 'Οικονόμου Σοφία', 'Καρδιολογική')], risk: 'high', unanswered: 30, representative: 'Μάρκου Ανδρέας',
    opening: { date: '2026-10-15', attendees: 'Διευθυντής ΤΕΠ, Μάρκου Ανδρέας, Σταθάτου Δήμητρα, Οικονόμου Σοφία' },
    overrides: { '7.1.5': nc('partial', '', 'Ο απινιδωτής του θαλάμου ανάνηψης έχει ληγμένη ετικέτα ελέγχου', 'Θάλαμος ανάνηψης') } }),
  audit('AUD-2611-106', { key: 'iso15189', department: 'Εργαστήριο', title: 'Επιθεώρηση ISO 15189 — Εργαστήριο', titleEn: 'ISO 15189 audit — Laboratory', planned: '2026-11-05', status: 'planned', team: [lead, external('tm-7', 'Ανδρεάδου Κατερίνα', 'Βιοπαθολόγος, εξωτερική επιθεωρήτρια')], risk: 'medium' }),
  audit('AUD-2611-107', { key: 'jci', department: 'Καρδιολογική', title: 'Επιθεώρηση JCI — Καρδιολογική', titleEn: 'JCI audit — Cardiology', planned: '2026-11-01', status: 'planned', monthOnly: true, scope: ['IPSG', 'ACC', 'PFE'], team: [lead], risk: 'high' }),
  audit('AUD-2611-108', { key: 'haccp', department: '', title: 'Επιθεώρηση HACCP — Κουζίνα', titleEn: 'HACCP audit — Kitchen', planned: '2026-11-20', status: 'planned', team: [lead, external('tm-8', 'Τζαννέτου Ειρήνη', 'Τεχνολόγος τροφίμων')], risk: 'high' }),
  audit('AUD-2612-109', { key: 'iso15224', department: 'ΜΕΘ', title: 'Επαναληπτική επιθεώρηση ISO 15224 — ΜΕΘ', titleEn: 'ISO 15224 follow-up audit — ICU', planned: '2026-12-10', status: 'planned', team: [lead, member('tm-9', 'EMP-001', 'Παπαδοπούλου Μαρία', 'ΜΕΘ')], risk: 'high', followUpOf: 'AUD-2609-104' }),
  audit('AUD-2612-110', { key: 'iso9001', department: '', title: 'Επιθεώρηση πιστοποίησης ISO 9001 (επιτήρηση)', titleEn: 'ISO 9001 certification audit (surveillance)', type: 'certification', planned: '2026-12-01', status: 'planned', monthOnly: true, team: [external('tm-10', 'Φορέας πιστοποίησης — επικεφαλής επιθεωρητής', 'Φορέας πιστοποίησης', 'lead')], risk: 'medium' }),
]

// The English title and description of each audit finding.
const FINDING_EN = {
  'FND-2603-101': ['ISO 9001 7.5.3 · Two versions of a form at the station', 'Audit AUD-2603-101, ISO 9001 7.5.3: two versions of the nursing accountability form were found at the station.'],
  'FND-2603-102': ['ISO 9001 9.1.2 · Satisfaction surveys are not discussed', 'Satisfaction surveys are collected but not discussed in the department meetings.'],
  'FND-2605-103': ['ISO 15224 CP-3 · Medication reconciliation at discharge', 'Medication reconciliation was not done in 3 of 10 discharges.'],
  'FND-2605-104': ['ISO 15224 8.5.1 · Structured shift handover (SBAR)', 'Shift handover is verbal, without a structured tool.'],
  'FND-2607-105': ['TEMOS T2.3 · Translation of the discharge note', 'The discharge note is given only in Greek and English.'],
  'FND-2609-106': ['JCI IPSG.3 · Concentrated KCl in an open cabinet', 'Audit AUD-2609-104, JCI IPSG.3: concentrated KCl in an open cabinet of room 2, without a high-alert label.'],
  'FND-2609-107': ['JCI IPSG.2 · Telephone orders without read-back', 'Two telephone orders without read-back documentation.'],
  'FND-2609-108': ['JCI PCI.8 · Contact isolation signage', 'Incomplete contact isolation signage in one room.'],
  'FND-2609-109': ['JCI MMU.6 · Barcode scanning at administration', 'Barcode scanning at medication administration is proposed.'],
}
const finding = (id, auditId, itemRef, findingClass, severity, status, title, description, owner, dueDate, extra = {}) => {
  const source = programmeAudits.find(item => item.id === auditId)
  const [itemClause, nth = 1] = itemRef.split('#')
  const row = source.checklist.filter(item => item.clauseRef === itemClause)[Number(nth) - 1]
  return { id, title, titleEn: FINDING_EN[id]?.[0] || title, source: 'audit', sourceId: auditId, department: source.department, departmentEn: source.departmentEn, departmentId: '', date: source.completedDate, severity, status, owner, owners: [owner], description, descriptionEn: FINDING_EN[id]?.[1] || description, attachments: [], history: [{ at: `${source.completedDate}T15:30:00+03:00`, action: 'findingCreated', actor: 'Σταθάτου Δήμητρα' }],
    findingClass, auditItemId: row?.id || null, clauseRef: itemClause, standard: source.standard, dueDate, verificationStatus: 'pending', verifiedOn: '', verifiedBy: '', verificationNote: '', followUpAuditId: '', ...extra }
}

export const programmeFindings = [
  finding('FND-2603-101', 'AUD-2603-101', '7.5.3', 'minor', 'medium', 'closed', 'ISO 9001 7.5.3 · Δύο εκδόσεις εντύπου στον σταθμό', 'Επιθεώρηση AUD-2603-101, ISO 9001 7.5.3: στον σταθμό βρέθηκαν δύο εκδόσεις του εντύπου νοσηλευτικής λογοδοσίας.', 'Προϊσταμένη Παθολογικής', '2026-05-17', { verificationStatus: 'effective', verifiedOn: '2026-06-10', verifiedBy: 'Σταθάτου Δήμητρα', verificationNote: 'Σε δειγματοληψία 10 εντύπων όλα στην τρέχουσα έκδοση.' }),
  finding('FND-2603-102', 'AUD-2603-101', '9.1.2', 'observation', 'low', 'open', 'ISO 9001 9.1.2 · Οι έρευνες ικανοποίησης δεν συζητούνται', 'Οι έρευνες ικανοποίησης συλλέγονται αλλά δεν συζητούνται στις συναντήσεις του τμήματος.', 'Δημητρίου Νικόλαος', '2026-06-16'),
  finding('FND-2605-103', 'AUD-2605-102', 'ΧΠ-3#2', 'minor', 'medium', 'inProgress', 'ISO 15224 ΧΠ-3 · Συμφιλίωση φαρμάκων κατά την έξοδο', 'Σε 3 από 10 εξόδους δεν έγινε συμφιλίωση φαρμάκων.', 'Κωνσταντίνου Ελένη', '2026-07-20'),
  finding('FND-2605-104', 'AUD-2605-102', '8.5.1#2', 'opportunity', 'low', 'open', 'ISO 15224 8.5.1 · Δομημένη παράδοση βάρδιας (SBAR)', 'Η παράδοση βάρδιας γίνεται προφορικά χωρίς δομημένο εργαλείο.', 'Κωνσταντίνου Ελένη', '2026-08-19'),
  finding('FND-2607-105', 'AUD-2607-103', 'T2.3', 'minor', 'medium', 'open', 'TEMOS T2.3 · Μετάφραση σημειώματος εξόδου', 'Το σημείωμα εξόδου δίνεται μόνο στα ελληνικά και αγγλικά.', 'Υπεύθυνη Γραφείου Διεθνών Ασθενών', '2026-09-06'),
  finding('FND-2609-106', 'AUD-2609-104', 'IPSG.3#2', 'major', 'high', 'inProgress', 'JCI IPSG.3 · Πυκνό KCl σε ανοιχτό ερμάριο', 'Επιθεώρηση AUD-2609-104, JCI IPSG.3: πυκνό KCl σε ανοιχτό ερμάριο του θαλάμου 2, χωρίς σήμανση υψηλού κινδύνου.', 'Παπαδοπούλου Μαρία', '2026-10-24', { followUpAuditId: 'AUD-2612-109' }),
  finding('FND-2609-107', 'AUD-2609-104', 'IPSG.2', 'minor', 'medium', 'open', 'JCI IPSG.2 · Τηλεφωνικές οδηγίες χωρίς read-back', 'Δύο τηλεφωνικές οδηγίες χωρίς τεκμηρίωση read-back.', 'Παπαδοπούλου Μαρία', '2026-11-23'),
  finding('FND-2609-108', 'AUD-2609-104', 'PCI.8', 'observation', 'low', 'open', 'JCI PCI.8 · Σήμανση απομόνωσης επαφής', 'Ελλιπής σήμανση απομόνωσης επαφής σε έναν θάλαμο.', 'Παπαδοπούλου Μαρία', '2026-12-23'),
  finding('FND-2609-109', 'AUD-2609-104', 'MMU.6', 'opportunity', 'low', 'open', 'JCI MMU.6 · Σάρωση barcode στη χορήγηση', 'Προτείνεται σάρωση barcode κατά τη χορήγηση φαρμάκων.', 'Φαρμακείο', '2026-12-23'),
]

export const programmeCapas = [
  { id: 'CAPA-2609-101', title: 'Απομάκρυνση πυκνών ηλεκτρολυτών από τα ερμάρια της ΜΕΘ', titleEn: 'Remove concentrated electrolytes from ICU cabinets', sourceType: 'finding', source: 'finding', sourceId: 'FND-2609-106', department: 'ΜΕΘ', departmentEn: 'ICU', departmentId: '', owner: 'Παπαδοπούλου Μαρία', owners: ['Παπαδοπούλου Μαρία', 'Φαρμακείο'], ownerId: null, status: 'inProgress', priority: 'high', severity: 'high', actionType: 'corrective',
    dueDate: '2026-10-24', effectivenessDue: '2026-11-24', effectivenessStatus: 'pending', description: 'Τα πυκνά διαλύματα KCl φυλάσσονται μόνο στο φαρμακείο και σε κλειδωμένο ερμάριο της ΜΕΘ με σήμανση υψηλού κινδύνου· διπλός έλεγχος στη χορήγηση.', descriptionEn: 'Concentrated KCl kept only in the pharmacy and a locked, labelled ICU cabinet; double check at administration.',
    subActions: [{ id: 'sa-2609-101-1', title: 'Απομάκρυνση KCl από τα ερμάρια θαλάμων', owner: 'Παπαδοπούλου Μαρία', dueDate: '2026-09-26', done: true, doneAt: '2026-09-25T18:00:00+03:00', doneBy: 'Παπαδοπούλου Μαρία' }, { id: 'sa-2609-101-2', title: 'Κλειδωμένο ερμάριο με σήμανση υψηλού κινδύνου', owner: 'Φαρμακείο', dueDate: '2026-10-10', done: true, doneAt: '2026-10-08T12:00:00+03:00', doneBy: 'Φαρμακείο' }, { id: 'sa-2609-101-3', title: 'Εκπαίδευση βαρδιών στον διπλό έλεγχο', owner: 'Παπαδοπούλου Μαρία', dueDate: '2026-10-24', done: false, doneAt: null, doneBy: '' }],
    rootCauseAnalysis: null, progress: [], attachments: [], history: [{ at: '2026-09-25T16:00:00+03:00', action: 'capaAssigned', actor: 'Σταθάτου Δήμητρα' }] },
]

// The answers that became findings point at them (the demo keeps codes).
for (const item of programmeFindings) {
  const source = programmeAudits.find(entry => entry.id === item.sourceId)
  source.findingIds.push(item.id)
}
