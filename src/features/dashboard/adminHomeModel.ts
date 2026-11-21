// The hospital administrator's home: five figures, what needs a decision, the departments that need attention,
// one compact status line per module and the coming week. Counts come from dashboard_metrics (a real hospital,
// 20261202110000) or demoDashboardMetrics.js (the Demo). A module the
// organization's profile switches off, or whose screen is not in the user's
// menu, is left out. Pure.

import { foldSearch } from '../../core/i18n/searchMatch'
import { calendarTypeLabel, type CalendarGroup } from '../calendar/calendarView'

// [metric key, Greek, English, screen, module] — only what is pending appears.
// [metric key, Greek, English, screen, module]
type DecisionItem = readonly [string, string, string, string, string]
// [module, Greek, English, screen, [[metric key, Greek, English, tone when > 0]]]
type ModuleRow = readonly [string, string, string, string, ReadonlyArray<readonly [string, string, string, string?]>]
type Metrics = Record<string, unknown>
interface HomeOptions { moduleEnabled?: (module: string) => boolean, canOpen?: (to: string) => boolean, language?: string }

export const DECISION_ITEMS: readonly DecisionItem[] = Object.freeze([
  ['supplierRenewalsToApprove', 'Ανανεώσεις πιστοποιητικών προς έγκριση αποστολής', 'Certificate renewals awaiting approval to send', '/quality', 'suppliers'],
  ['supplierRenewalsToReview', 'Πιστοποιητικά προμηθευτών προς έλεγχο', 'Supplier certificates to review', '/quality', 'suppliers'],
  ['expiredCertificates', 'Ληγμένα πιστοποιητικά χωρίς ανανέωση', 'Expired certificates not renewed', '/quality', 'suppliers'],
  ['criticalUncommunicated', 'Κρίσιμα εργαστηριακά αποτελέσματα χωρίς ενημέρωση', 'Critical laboratory results not communicated', '/laboratory', 'laboratory'],
  ['overdueControls', 'Εκπρόθεσμοι έλεγχοι', 'Overdue controls', '/controls', 'controls'],
  ['overdueCapa', 'Εκπρόθεσμες διορθωτικές ενέργειες', 'Overdue corrective actions', '/quality', 'quality'],
  ['pendingApprovals', 'Αντιμικροβιακές αγωγές προς έγκριση', 'Antimicrobial therapies awaiting approval', '/pharmacy', 'pharmacy'],
  ['kitchenUnverifiedDays', 'Ημέρες κουζίνας χωρίς επαλήθευση HACCP (30 ημ.)', 'Kitchen days without HACCP verification (30 d)', '/kitchen', 'kitchen'],
])
// Severe items first: expired, critical and overdue before the rest.
const URGENT = new Set(['expiredCertificates', 'criticalUncommunicated', 'overdueCapa', 'overdueControls'])

const count = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function decisionItems(metrics: Metrics = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' }: HomeOptions = {}) {
  const en = language === 'en'
  return DECISION_ITEMS
    .filter(([key, , , to, module]) => count(metrics[key]) > 0 && moduleEnabled(module) && canOpen(to))
    .map(([key, el, enText, to]) => ({ key, title: en ? enText : el, count: count(metrics[key]), to, urgent: URGENT.has(key) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent))
}

// [module, Greek, English, screen, [[metric key, Greek, English, tone when > 0]]]
export const MODULE_ROWS: readonly ModuleRow[] = Object.freeze([
  ['surveillance', 'Επιτήρηση', 'Surveillance', '/surveillance', [['activeSurveillance', 'ενεργές επιτηρήσεις', 'active cases'], ['isolationReviewsDue', 'επανεκτιμήσεις απομόνωσης', 'isolation reviews due', 'warning']]],
  ['laboratory', 'Εργαστήριο', 'Laboratory', '/laboratory', [['pendingSamples', 'εκκρεμή δείγματα', 'pending samples'], ['criticalUncommunicated', 'κρίσιμα χωρίς ενημέρωση', 'critical not communicated', 'danger']]],
  ['controls', 'Έλεγχοι', 'Controls', '/controls', [['overdueControls', 'εκπρόθεσμοι', 'overdue', 'danger']]],
  ['quality', 'Ποιότητα', 'Quality', '/quality', [['openIncidents', 'ανοιχτά συμβάντα', 'open incidents'], ['overdueCapa', 'εκπρόθεσμες διορθωτικές', 'overdue CAPA', 'danger']]],
  ['suppliers', 'Προμηθευτές', 'Suppliers', '/quality', [['expiredCertificates', 'ληγμένα πιστοποιητικά χωρίς ανανέωση', 'expired certificates not renewed', 'danger'], ['expiringCertificates', 'λήγουν σε 30 ημέρες', 'expire within 30 days', 'warning']]],
  ['kitchen', 'Κουζίνα', 'Kitchen', '/kitchen', [['kitchenOutOfLimits30d', 'εκτός ορίων (30 ημ.)', 'out of limits (30 d)', 'warning'], ['kitchenUnverifiedDays', 'ημέρες χωρίς επαλήθευση', 'days not verified', 'warning']]],
  ['pharmacy', 'Φαρμακείο', 'Pharmacy', '/pharmacy', [['pendingApprovals', 'εγκρίσεις σε αναμονή', 'approvals pending', 'warning'], ['antimicrobialTherapies', 'αντιμικροβιακές αγωγές', 'antimicrobial therapies']]],
  ['interviews', 'Συνεντεύξεις', 'Interviews', '/interviews', [['openCandidates', 'ανοιχτές αιτήσεις', 'open applications'], ['newCandidates', 'νέες', 'new', 'warning'], ['upcomingInterviews', 'προγραμματισμένες', 'scheduled']]],
  ['governance', 'Επιτροπές', 'Committees', '/meetings', [['pendingMinutes', 'πρακτικά σε εκκρεμότητα', 'minutes pending', 'warning'], ['openDecisions', 'ανοιχτές αποφάσεις', 'open decisions']]],
])

// «Εκπαίδευση» (owner, 21/11/2026): its figures are not in dashboard_metrics; the home counts them (participation
// requests waiting, expired staff certificates) and the line shows only when one of them was counted.
export const TRAINING_ROW: ModuleRow = Object.freeze(['training', 'Εκπαίδευση', 'Training', '/training', [['trainingRequests', 'αιτήσεις συμμετοχής', 'participation requests', 'warning'], ['trainingCertificatesExpired', 'ληγμένα πιστοποιητικά προσωπικού', 'expired staff certificates', 'danger']]])

export function moduleStatusRows(metrics: Metrics = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' }: HomeOptions = {}) {
  const en = language === 'en'
  const training = TRAINING_ROW[4].some(([key]) => metrics[key] != null)
  const rows = MODULE_ROWS.flatMap(row => row[0] === 'quality' && training ? [row, TRAINING_ROW] : [row])
  return rows
    .filter(([module, , , to]) => moduleEnabled(module) && canOpen(to))
    .map(([module, el, enText, to, figures]) => {
      const values = figures.map(([key, fel, fen, tone]) => ({ key, label: en ? fen : fel, value: metrics[key] == null ? null : count(metrics[key]), tone: tone && count(metrics[key]) > 0 ? tone : '' }))
      const status = values.some(item => item.tone === 'danger') ? 'danger' : values.some(item => item.tone === 'warning') ? 'warning' : 'good'
      return { module, title: en ? enText : el, to, values, status }
    })
}

// ——— The administrator's home, one screen (owner, 21/11/2026) ———

// Five figures above the cards; each only when its module is on, its screen is in the menu and it has a count.
// value: undefined while loading; a tile whose count is missing once loaded (no source) is left out, never a wrong 0.
export interface AdminTile { key: string, label: string, value: number | undefined, detail: string, tone: 'danger' | 'warning' | null, to: string }
export interface AdminTileSources {
  loading?: boolean
  // «Δείγματα προς έλεγχο»: positive samples with no surveillance decision (the «Προς έλεγχο» list); null when the user does not review samples.
  awaitingReview?: number | null
  isolation?: number | null
  overdueControlDepartments?: number | null
  openCapa?: number | null
}
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`
export function adminHomeTiles(metrics: Metrics = {}, sources: AdminTileSources = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' }: HomeOptions = {}): AdminTile[] {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const metric = (key: string) => metrics[key] == null || !Number.isFinite(Number(metrics[key])) ? null : Number(metrics[key])
  const tiles: AdminTile[] = []
  const add = (module: string, key: string, value: number | null | undefined, tile: Omit<AdminTile, 'key' | 'value'>) => {
    if (!moduleEnabled(module) || !canOpen(tile.to)) return
    if (value == null && !sources.loading) return
    tiles.push({ key, value: value ?? undefined, ...tile })
  }
  const isolation = sources.isolation
  add('surveillance', 'activeSurveillance', metric('activeSurveillance'), { label: tr('Ενεργές επιτηρήσεις', 'Active surveillance'), to: '/surveillance', tone: null,
    detail: isolation != null ? tr(`${isolation} σε απομόνωση`, `${isolation} in isolation`) : tr('ασθενείς σε επιτήρηση', 'patients under surveillance') })
  if (sources.awaitingReview !== null) add('laboratory', 'awaitingReview', sources.awaitingReview, { label: tr('Δείγματα προς έλεγχο', 'Samples to review'), to: '/surveillance?tab=episodes&review=1',
    tone: Number(sources.awaitingReview) > 0 ? 'danger' : null, detail: tr('θετικά χωρίς απόφαση', 'positive, no decision yet') })
  const departments = sources.overdueControlDepartments
  add('controls', 'overdueControls', metric('overdueControls'), { label: tr('Εκπρόθεσμοι έλεγχοι', 'Overdue controls'), to: '/controls', tone: Number(metrics.overdueControls) > 0 ? 'danger' : null,
    detail: departments ? (en ? `in ${plural(departments, 'department', 'departments')}` : `σε ${plural(departments, 'τμήμα', 'τμήματα')}`) : tr('εκτός προθεσμίας', 'past their due date') })
  const open = sources.openCapa
  add('quality', 'overdueCapa', metric('overdueCapa'), { label: tr('Εκπρόθεσμες διορθωτικές', 'Overdue corrective actions'), to: '/quality?tab=actions', tone: Number(metrics.overdueCapa) > 0 ? 'danger' : null,
    detail: open != null ? tr(`από ${open} ανοιχτές`, `of ${open} open`) : tr('εκτός προθεσμίας', 'past their due date') })
  add('suppliers', 'expiredCertificates', metric('expiredCertificates'), { label: tr('Ληγμένα πιστοποιητικά', 'Expired certificates'), to: '/quality?tab=resources', tone: Number(metrics.expiredCertificates) > 0 ? 'warning' : null,
    detail: tr('χωρίς ανανέωση', 'not renewed') })
  return tiles
}

// The calendar's events the home reads (calendarEvents.buildCalendarEvents): overdue ones carry their department.
interface HomeEvent { id: string, kind: string, date: string, state: string, title: string, department?: string }

// A staff certificate expired and not renewed: no later certificate of the same title for the same person. The
// training records are read in full (a renewal lies years ahead, outside the calendar's week).
interface HomeCertificate { id: string, title?: string | null, validUntil?: string | null, userId?: string | null, employeeId?: string | null, assignmentId?: string | null }
interface HomeTraining { certificates?: HomeCertificate[] | null, assignments?: Array<{ id: string, userId?: string | null, employeeId?: string | null, employeeName?: string | null }> | null }
export function expiredCertificateEvents<T extends HomeEvent>(events: T[], training: HomeTraining | null | undefined = null): T[] {
  const certificates = training?.certificates || []
  const assignments = new Map((training?.assignments || []).map(row => [row.id, row]))
  const who = (row: HomeCertificate) => { const assignment = row.assignmentId ? assignments.get(row.assignmentId) : undefined; return row.userId || row.employeeId || assignment?.userId || assignment?.employeeId || assignment?.employeeName || row.id }
  const renewed = new Set(certificates.filter(row => certificates.some(other => other !== row && other.title === row.title && who(other) === who(row) && String(other.validUntil || '') > String(row.validUntil || ''))).map(row => `cert:${row.id}`))
  return events.filter(event => String(event.id).startsWith('cert:') && event.state === 'overdue' && !renewed.has(event.id))
}

// «Εκπρόθεσμοι έλεγχοι σε N τμήματα»: the departments with a control past its due date.
const overdueControl = (event: HomeEvent) => (event.kind === 'controls' || event.kind === 'cultures') && event.state === 'overdue' && String(event.id).startsWith('ctrl:')
const overdueCapa = (event: HomeEvent) => event.kind === 'capa' && event.state === 'overdue' && String(event.id).startsWith('capa:')
export function overdueControlDepartments(events: HomeEvent[]) {
  return new Set(events.filter(event => overdueControl(event) && event.department).map(event => event.department)).size
}

// «Τμήματα που θέλουν προσοχή»: the departments with the most overdue items — controls, corrective actions, expired staff
// certificates — numbers only. A column whose source the user cannot read is null (not shown).
export interface DepartmentAttention { department: string, controls: number, capa: number, certificates: number, total: number }
export function departmentsNeedingAttention(events: HomeEvent[], training: HomeTraining | null | undefined = null, limit = 3): DepartmentAttention[] {
  const rows = new Map<string, DepartmentAttention>()
  const bump = (department: string | undefined, column: 'controls' | 'capa' | 'certificates') => {
    if (!department) return
    const row = rows.get(department) || { department, controls: 0, capa: 0, certificates: 0, total: 0 }
    row[column] += 1
    row.total += 1
    rows.set(department, row)
  }
  for (const event of events) {
    if (overdueControl(event)) bump(event.department, 'controls')
    else if (overdueCapa(event)) bump(event.department, 'capa')
  }
  for (const event of expiredCertificateEvents(events, training)) bump(event.department, 'certificates')
  return [...rows.values()].sort((a, b) => b.total - a.total || b.controls - a.controls || a.department.localeCompare(b.department, 'el')).slice(0, limit)
}

// «Επόμενες 7 ημέρες»: one line per item, the same control of many departments once —
// «Απινιδωτής · Έλεγχος» with «6 τμήματα» beside it (calendarView.nextDaysGroups groups them).
export function adminWeekLine(group: CalendarGroup, language = 'el') {
  const en = language === 'en'
  const title = String(group.first.title || '')
  const type = calendarTypeLabel(group.first, language)
  const word = foldSearch(type).split(' ')[0]
  const what = foldSearch(title).startsWith(word) ? title : `${title} · ${type}`
  const where = group.departments.length > 1 ? (en ? `${group.departments.length} departments` : `${group.departments.length} τμήματα`)
    : group.people.length > 1 ? (en ? `${group.people.length} people` : `${group.people.length} άτομα`)
      : group.departments[0] || ''
  return { what, where, text: where ? `${what} · ${where}` : what }
}
