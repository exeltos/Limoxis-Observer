// The hospital administrator's home: what needs a decision, and one compact
// status line per module. Counts come from dashboard_metrics (a real hospital,
// 20261202110000) or demoDashboardMetrics.js (the Demo). A module the
// organization's profile switches off, or whose screen is not in the user's
// menu, is left out. Pure.

// [metric key, Greek, English, screen, module] — only what is pending appears.
export const DECISION_ITEMS = Object.freeze([
  ['supplierRenewalsToApprove', 'Ανανεώσεις πιστοποιητικών προς έγκριση αποστολής', 'Certificate renewals awaiting approval to send', '/quality', 'suppliers'],
  ['supplierRenewalsToReview', 'Πιστοποιητικά προμηθευτών προς έλεγχο', 'Supplier certificates to review', '/quality', 'suppliers'],
  ['expiredCertificates', 'Ληγμένα πιστοποιητικά προμηθευτών', 'Expired supplier certificates', '/quality', 'suppliers'],
  ['criticalUncommunicated', 'Κρίσιμα εργαστηριακά αποτελέσματα χωρίς ενημέρωση', 'Critical laboratory results not communicated', '/laboratory', 'laboratory'],
  ['overdueControls', 'Εκπρόθεσμοι έλεγχοι', 'Overdue controls', '/controls', 'controls'],
  ['overdueCapa', 'Εκπρόθεσμες διορθωτικές ενέργειες', 'Overdue corrective actions', '/quality', 'quality'],
  ['pendingApprovals', 'Αντιμικροβιακές αγωγές προς έγκριση', 'Antimicrobial therapies awaiting approval', '/pharmacy', 'pharmacy'],
  ['kitchenUnverifiedDays', 'Ημέρες κουζίνας χωρίς επαλήθευση HACCP (30 ημ.)', 'Kitchen days without HACCP verification (30 d)', '/kitchen', 'kitchen'],
])
// Severe items first: expired, critical and overdue before the rest.
const URGENT = new Set(['expiredCertificates', 'criticalUncommunicated', 'overdueCapa', 'overdueControls'])

const count = value => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function decisionItems(metrics = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' } = {}) {
  const en = language === 'en'
  return DECISION_ITEMS
    .filter(([key, , , to, module]) => count(metrics[key]) > 0 && moduleEnabled(module) && canOpen(to))
    .map(([key, el, enText, to]) => ({ key, title: en ? enText : el, count: count(metrics[key]), to, urgent: URGENT.has(key) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent))
}

// [module, Greek, English, screen, [[metric key, Greek, English, tone when > 0]]]
export const MODULE_ROWS = Object.freeze([
  ['surveillance', 'Επιτήρηση', 'Surveillance', '/surveillance', [['activeSurveillance', 'ενεργές επιτηρήσεις', 'active cases'], ['isolationReviewsDue', 'επανεκτιμήσεις απομόνωσης', 'isolation reviews due', 'warning']]],
  ['laboratory', 'Εργαστήριο', 'Laboratory', '/laboratory', [['pendingSamples', 'εκκρεμή δείγματα', 'pending samples'], ['criticalUncommunicated', 'κρίσιμα χωρίς ενημέρωση', 'critical not communicated', 'danger']]],
  ['controls', 'Έλεγχοι', 'Controls', '/controls', [['overdueControls', 'εκπρόθεσμοι', 'overdue', 'danger']]],
  ['quality', 'Ποιότητα', 'Quality', '/quality', [['openIncidents', 'ανοιχτά συμβάντα', 'open incidents'], ['overdueCapa', 'εκπρόθεσμες διορθωτικές', 'overdue CAPA', 'danger']]],
  ['suppliers', 'Προμηθευτές', 'Suppliers', '/quality', [['expiredCertificates', 'ληγμένα πιστοποιητικά', 'expired certificates', 'danger'], ['expiringCertificates', 'λήγουν σε 30 ημέρες', 'expire within 30 days', 'warning']]],
  ['kitchen', 'Κουζίνα', 'Kitchen', '/kitchen', [['kitchenOutOfLimits30d', 'εκτός ορίων (30 ημ.)', 'out of limits (30 d)', 'warning'], ['kitchenUnverifiedDays', 'ημέρες χωρίς επαλήθευση', 'days not verified', 'warning']]],
  ['pharmacy', 'Φαρμακείο', 'Pharmacy', '/pharmacy', [['pendingApprovals', 'εγκρίσεις σε αναμονή', 'approvals pending', 'warning'], ['antimicrobialTherapies', 'αντιμικροβιακές αγωγές', 'antimicrobial therapies']]],
  ['interviews', 'Συνεντεύξεις', 'Interviews', '/interviews', [['openCandidates', 'ανοιχτές αιτήσεις', 'open applications'], ['newCandidates', 'νέες', 'new', 'warning'], ['upcomingInterviews', 'προγραμματισμένες', 'scheduled']]],
  ['governance', 'Επιτροπές', 'Committees', '/committees', [['pendingMinutes', 'πρακτικά σε εκκρεμότητα', 'minutes pending', 'warning'], ['openDecisions', 'ανοιχτές αποφάσεις', 'open decisions']]],
])

export function moduleStatusRows(metrics = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' } = {}) {
  const en = language === 'en'
  return MODULE_ROWS
    .filter(([module, , , to]) => moduleEnabled(module) && canOpen(to))
    .map(([module, el, enText, to, figures]) => {
      const values = figures.map(([key, fel, fen, tone]) => ({ key, label: en ? fen : fel, value: metrics[key] == null ? null : count(metrics[key]), tone: tone && count(metrics[key]) > 0 ? tone : '' }))
      const status = values.some(item => item.tone === 'danger') ? 'danger' : values.some(item => item.tone === 'warning') ? 'warning' : 'good'
      return { module, title: en ? enText : el, to, values, status }
    })
}
