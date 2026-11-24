// The hospital administrator's home: five figures, the departments with the most pending items, what else needs a
// decision and the week day by day. Counts come from dashboard_metrics (a real hospital, 20261202110000) or
// demoDashboardMetrics.js (the Demo). A module the organization's profile switches off, or whose screen is not in the
// user's menu, is left out. Pure.

import { addDay } from '../calendar/calendarView'
import { calendarFilterOf, type CalendarEvent } from '../calendar/calendarEvents'

// [metric key, Greek, English, screen, module ('' when no module gates it)]
type DecisionItem = readonly [string, string, string, string, string]
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

// «Χρειάζονται απόφαση» (owner, 21/11/2026; 24/11/2026 the expired supplier certificates left the figures for it): only
// what the five figures do not already show — no overdue controls, overdue corrective actions or samples to review —
// with the objectives off course,
// the minutes pending, supplier certificates expiring within 30 days and the training participation requests.
// missedObjectives and trainingRequests are counted by the home (they are not in dashboard_metrics).
export const TILE_DECISION_KEYS: ReadonlySet<string> = new Set(['overdueControls', 'overdueCapa', 'awaitingReview'])
// Short titles: two columns of them fit the card on a tablet (the full title stays in each line's tooltip).
export const HOME_DECISION_ITEMS: readonly DecisionItem[] = Object.freeze([
  ['expiredCertificates', 'Ληγμένα πιστοποιητικά προμηθευτών', 'Expired supplier certificates', '/quality?tab=resources', 'suppliers'],
  ['criticalUncommunicated', 'Κρίσιμα χωρίς ενημέρωση', 'Critical results not communicated', '/laboratory', 'laboratory'],
  ['pendingApprovals', 'Αντιμικροβιακές προς έγκριση', 'Antimicrobials to approve', '/pharmacy', 'pharmacy'],
  ['missedObjectives', 'Στόχοι που δεν επιτυγχάνονται', 'Objectives not met', '/quality/measures', ''],
  ['pendingMinutes', 'Πρακτικά σε εκκρεμότητα', 'Minutes pending', '/meetings', 'governance'],
  ['expiringCertificates', 'Προμηθευτές: λήξη σε 30 ημέρες', 'Suppliers: expiring in 30 days', '/quality', 'suppliers'],
  ['supplierRenewalsToApprove', 'Ανανεώσεις προς αποστολή', 'Renewals to approve', '/quality', 'suppliers'],
  ['supplierRenewalsToReview', 'Πιστοποιητικά προς έλεγχο', 'Certificates to review', '/quality', 'suppliers'],
  ['trainingRequests', 'Αιτήσεις συμμετοχής εκπαίδευσης', 'Training requests', '/training', 'training'],
  ['kitchenUnverifiedDays', 'Κουζίνα χωρίς επαλήθευση HACCP', 'Kitchen days not verified', '/kitchen', 'kitchen'],
] as DecisionItem[])
export function otherDecisionItems(metrics: Metrics = {}, { moduleEnabled = () => true, canOpen = () => true, language = 'el' }: HomeOptions = {}) {
  const en = language === 'en'
  return HOME_DECISION_ITEMS
    .filter(([key, , , to, module]) => !TILE_DECISION_KEYS.has(key) && count(metrics[key]) > 0 && (!module || moduleEnabled(module)) && canOpen(to))
    .map(([key, el, enText, to]) => ({ key, title: en ? enText : el, count: count(metrics[key]), to, urgent: URGENT.has(key) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent))
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
    detail: isolation === 0 ? tr('κανείς σε απομόνωση', 'no one in isolation') : isolation != null ? tr(`${isolation} σε απομόνωση`, `${isolation} in isolation`) : tr('ασθενείς σε επιτήρηση', 'patients under surveillance') })
  if (sources.awaitingReview !== null) add('laboratory', 'awaitingReview', sources.awaitingReview, { label: tr('Δείγματα προς έλεγχο', 'Samples to review'), to: '/surveillance?tab=episodes&review=1',
    tone: Number(sources.awaitingReview) > 0 ? 'danger' : null, detail: tr('θετικά χωρίς απόφαση', 'positive, no decision yet') })
  const departments = sources.overdueControlDepartments
  add('controls', 'overdueControls', metric('overdueControls'), { label: tr('Εκπρόθεσμοι έλεγχοι', 'Overdue controls'), to: '/controls', tone: Number(metrics.overdueControls) > 0 ? 'danger' : null,
    detail: departments ? (en ? `in ${plural(departments, 'department', 'departments')}` : `σε ${plural(departments, 'τμήμα', 'τμήματα')}`) : tr('εκτός προθεσμίας', 'past their due date') })
  const open = sources.openCapa
  add('quality', 'overdueCapa', metric('overdueCapa'), { label: tr('Εκπρόθεσμες διορθωτικές', 'Overdue corrective actions'), to: '/quality?tab=actions', tone: Number(metrics.overdueCapa) > 0 ? 'danger' : null,
    detail: open != null ? tr(`από ${open} ανοιχτές`, `of ${open} open`) : tr('εκτός προθεσμίας', 'past their due date') })
  add('suppliers', 'expiredCertificates', metric('expiredCertificates'), { label: tr('Ληγμένα πιστοποιητικά', 'Expired certificates'), to: '/quality?tab=resources', tone: Number(metrics.expiredCertificates) > 0 ? 'warning' : null,
    detail: tr('προμηθευτών, χωρίς ανανέωση', "suppliers', not renewed") })
  return tiles
}

// The calendar's events the home reads (calendarEvents.buildCalendarEvents): overdue ones carry their department.
interface HomeEvent { id: string, kind: string, date: string, state: string, title: string, department?: string, time?: string }

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
// A control is late from its due time (the metric counts next_due_at < now): a daily control due at 09:00 is overdue at
// noon the same day, although the calendar marks the whole day «due». now: the hospital's day and time (HH:MM).
export interface HomeNow { date: string, time: string }
const overdueControl = (event: HomeEvent, now: HomeNow | null = null) => (event.kind === 'controls' || event.kind === 'cultures') && String(event.id).startsWith('ctrl:')
  && (event.state === 'overdue' || Boolean(now && event.state === 'due' && event.date === now.date && event.time && String(event.time) <= now.time))
const overdueCapa = (event: HomeEvent) => event.kind === 'capa' && event.state === 'overdue' && String(event.id).startsWith('capa:')
export function overdueControlDepartments(events: HomeEvent[], now: HomeNow | null = null) {
  return new Set(events.filter(event => overdueControl(event, now) && event.department).map(event => event.department)).size
}

// «Τμήματα με τις περισσότερες εκκρεμότητες»: the departments with the most overdue items — controls, corrective actions,
// expired staff certificates — one stacked bar each.
export interface DepartmentAttention { department: string, controls: number, capa: number, certificates: number, total: number }
// The events are built in Greek for these counts (a CAPA's department in English is its translated name: the same
// department would split into two rows).
export function departmentsNeedingAttention(events: HomeEvent[], training: HomeTraining | null | undefined = null, limit = 8, now: HomeNow | null = null): DepartmentAttention[] {
  const rows = new Map<string, DepartmentAttention>()
  const bump = (department: string | undefined, column: 'controls' | 'capa' | 'certificates') => {
    if (!department) return
    const row = rows.get(department) || { department, controls: 0, capa: 0, certificates: 0, total: 0 }
    row[column] += 1
    row.total += 1
    rows.set(department, row)
  }
  for (const event of events) {
    if (overdueControl(event, now)) bump(event.department, 'controls')
    else if (overdueCapa(event)) bump(event.department, 'capa')
  }
  for (const event of expiredCertificateEvents(events, training)) bump(event.department, 'certificates')
  return [...rows.values()].sort((a, b) => b.total - a.total || b.controls - a.controls || a.department.localeCompare(b.department, 'el')).slice(0, limit)
}

// «Η εβδομάδα» (owner, 21/11/2026): exactly seven lines, today and the next six days, each with what it has as short
// chips — controls and cultures as counts («41 έλεγχοι · 12 τμήματα» today), expiries and documents as counts,
// trainings and meetings by name when a day has one or two of them, else as counts. Nothing is cut with «+N ακόμη»:
// the line opens the calendar on that day (/calendar?day=YYYY-MM-DD).
export type WeekChipKind = 'controls' | 'cultures' | 'meetings' | 'training' | 'expiries' | 'documents' | 'other'
// named: a training or a meeting by its name (it may be shortened); counts keep their width.
export interface WeekChip { key: string, kind: WeekChipKind, text: string, named?: boolean }
export interface WeekDay { date: string, label: string, today: boolean, chips: WeekChip[], path: string }
const WEEK_DONE = new Set(['done', 'late', 'missed', 'overdue'])
const WEEK_WORDS: Record<'el' | 'en', Record<string, [string, string]>> = {
  el: { controls: ['έλεγχος', 'έλεγχοι'], cultures: ['καλλιέργεια', 'καλλιέργειες'], departments: ['τμήμα', 'τμήματα'], expiries: ['λήξη', 'λήξεις'], documents: ['έγγραφο', 'έγγραφα'], training: ['εκπαίδευση', 'εκπαιδεύσεις'], meetings: ['συνεδρίαση', 'συνεδριάσεις'], other: ['άλλο', 'άλλα'] },
  en: { controls: ['control', 'controls'], cultures: ['culture', 'cultures'], departments: ['department', 'departments'], expiries: ['expiry', 'expiries'], documents: ['document', 'documents'], training: ['training', 'trainings'], meetings: ['meeting', 'meetings'], other: ['other', 'other'] },
}
const TRAINING_STEP: Record<'el' | 'en', Record<string, string>> = { el: { start: 'έναρξη', due: 'προθεσμία', eff: 'αξιολόγηση' }, en: { start: 'start', due: 'due', eff: 'evaluation' } }
function weekKind(event: CalendarEvent): WeekChipKind {
  const filter = calendarFilterOf(event)
  if (filter === 'controls' || filter === 'cultures' || filter === 'expiries' || filter === 'training' || filter === 'meetings') return filter
  return event.kind === 'documents' ? 'documents' : 'other'
}
// The name a training or a meeting shows: «Υγιεινή χεριών (έναρξη)», a committee meeting by its committee.
function weekName(event: CalendarEvent, lang: 'el' | 'en') {
  const id = String(event.id || '')
  const step = /^trn-(start|due|eff):/.exec(id)?.[1]
  if (step) return `${event.title} (${TRAINING_STEP[lang][step]})`
  if (id.startsWith('mtg:')) return String(event.detail || event.title || '')
  return String(event.title || '')
}
export function weekSummary(events: CalendarEvent[] | null | undefined, today: string, language = 'el'): WeekDay[] {
  const lang = language === 'en' ? 'en' : 'el'
  const words = WEEK_WORDS[lang]
  const many = (value: number, kind: string) => `${value} ${words[kind][value === 1 ? 0 : 1]}`
  const weekday = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'el-GR', { weekday: 'short' })
  const open = (events || []).filter(event => !WEEK_DONE.has(event.state))
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDay(today, index)
    const byKind = new Map<WeekChipKind, CalendarEvent[]>()
    for (const event of open) if (event.date === date) { const kind = weekKind(event); byKind.set(kind, [...(byKind.get(kind) || []), event]) }
    const chips: WeekChip[] = []
    for (const kind of ['controls', 'cultures', 'meetings', 'training', 'expiries', 'documents', 'other'] as const) {
      const list = byKind.get(kind)
      if (!list?.length) continue
      if (kind === 'meetings' || kind === 'training') {
        const names = [...new Set(list.map(event => weekName(event, lang)).filter(Boolean))]
        if (names.length && names.length <= 2) { names.forEach(name => chips.push({ key: `${kind}:${name}`, kind, text: name, named: true })); continue }
      }
      const departments = kind === 'controls' && index === 0 ? new Set(list.map(event => event.department).filter(Boolean)).size : 0
      chips.push({ key: kind, kind, text: departments > 1 ? `${many(list.length, kind)} · ${many(departments, 'departments')}` : many(list.length, kind) })
    }
    const label = index === 0 ? (lang === 'en' ? 'Today' : 'Σήμερα') : `${weekday.format(new Date(`${date}T12:00:00`))} ${Number(date.slice(8, 10))}`
    return { date, label, today: index === 0, chips, path: `/calendar?day=${date}` }
  })
}
