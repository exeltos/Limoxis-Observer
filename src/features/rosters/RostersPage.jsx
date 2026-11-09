import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Eraser, GripVertical, History, Inbox, Megaphone, RotateCcw, SlidersHorizontal, Trash2, Wand2, X } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ROLES } from '../../core/permissions/roles'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { TimeField } from '../../design-system/TimeField'
import { StatusBadge } from '../../design-system/StatusBadge'
import { downloadXlsx } from '../../core/export/xlsxExport'
import { DEFAULT_RULES, checkRoster, customShifts, datesBetween, demandFor, generateRoster, isLeave, isShift, kindFromStart, kindOf, periodDays, shiftTargets } from './rosterEngine'
import { IASO_SHIFT_CODES } from './iasoShiftCodes'
import {
  createRosterRequest,
  deleteRoster,
  headsFirst,
  loadDepartmentHeadUserIds,
  loadDepartmentStaff,
  loadRoster,
  loadRosterDepartments,
  loadRosterHistory,
  loadRosterRequests,
  markHeads,
  rosterChanges,
  rosterPeriod,
  saveRoster,
  setRosterRequestStatus,
} from './rosterService'
import './rosters.css'

// The department's monthly shift roster (owner, 8/11/2026). It opens as an empty sheet with every name, so leave and
// wishes go in first; «Αυτόματη δημιουργία» fills only the empty cells (what was set by hand stays). Under each day the
// people on each shift against those needed (a click sets the day's own number); beside each person their totals,
// hours and target. The head of the department is first, the others are dragged into the order of priority; a click
// on a name sets the shifts that person may take. The new roster starts from the end of the previous one.
// The department's people send requests (leave, a day off, a day they cannot work, a swap) and see the roster once it
// is published; every change after publishing is logged.
// At least two people on every shift by default (owner, 8/11/2026); more on a shift is fine.
const DEMAND = { weekday: { M: 2, I: 0, A: 2, N: 2 }, weekend: { M: 2, I: 0, A: 2, N: 2 }, overrides: {} }
const SHIFTS = ['M', 'I', 'A', 'N']
const LEAVES = ['L', 'S', 'H', 'U']
const HOURS = 8
const WRITERS = new Set([ROLES.HOSPITAL_ADMIN, ROLES.DEPARTMENT_MANAGER, ROLES.DEMO, ROLES.PLATFORM_OWNER])
const STAFF = new Set([ROLES.DEPARTMENT_USER, ROLES.LINK_NURSE])
const RULE_FIELDS = ['maxConsecutive', 'maxConsecutiveNights', 'restAfterNight', 'restAfterTwoNights', 'weeklyRestDays', 'minWeekendOff']
// A request turns into: a leave code, a wished day off, a day off that is fixed («cannot work»), or a swap.
const REQUEST_CODE = { leave: 'L', sick: 'S', unpaid: 'U', unavailable: 'R' }
// The head is supernumerary unless set otherwise: not counted in the shifts, there only where the others are short.
const isExtra = m => (typeof m.extra === 'boolean' ? m.extra : Boolean(m.isHead))

export function RostersPage() {
  const { user, profile } = useAuth()
  const { tenant, role, membership, isDemo } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const canEdit = WRITERS.has(role)
  const staffMode = !canEdit && STAFF.has(role)
  const [roster, setRoster] = useState(null)
  // The codes on the sheet: letters, or the hospital's own payroll numbers (ΙΑΣΩ: 4, 12, 19, 20, R, Α, Γ, Κ, B, as in
  // its Excel); chosen per department in the rules, by default the numbers in ΙΑΣΩ (owner, 8/11/2026).
  const codeStyle = roster?.rules?.codes || (/ΙΑΣΩ|IASO/i.test(tenant?.name || '') ? 'iaso' : 'letters')
  const CODES = useMemo(() => {
    const iaso = codeStyle === 'iaso'
    const short = (letters, number) => (iaso ? number : letters)
    return {
      M: { short: short(tx('Π', 'M'), '4'), label: tx('Πρωί 07–15', 'Morning 07–15'), name: tx('Πρωί', 'Morning') },
      I: { short: short(tx('Ε', 'I'), '12'), label: tx('Ενδιάμεση 11–19', 'Intermediate 11–19'), name: tx('Ενδιάμεση', 'Intermediate') },
      A: { short: short(tx('Α', 'A'), '19'), label: tx('Απόγευμα 15–23', 'Afternoon 15–23'), name: tx('Απόγευμα', 'Afternoon') },
      N: { short: short(tx('Ν', 'N'), '20'), label: tx('Νύχτα 23–07', 'Night 23–07'), name: tx('Νύχτα', 'Night') },
      R: { short: short(tx('Ρ', 'R'), 'R'), label: tx('Ρεπό', 'Day off') },
      L: { short: short(tx('ΑΔ', 'LV'), 'Α'), label: tx('Κανονική άδεια', 'Annual leave') },
      S: { short: short(tx('ΑΣ', 'SK'), 'Γ'), label: tx('Ασθένεια', 'Sick leave') },
      H: { short: short(tx('ΑΡ', 'PH'), 'Κ'), label: tx('Αργία', 'Public holiday') },
      U: { short: short(tx('ΑΑ', 'UL'), 'B'), label: tx('Άδεια άνευ αποδοχών', 'Unpaid leave') },
    }
  }, [en, codeStyle]) // eslint-disable-line react-hooks/exhaustive-deps
  const REQUEST_KINDS = {
    leave: tx('Κανονική άδεια', 'Annual leave'),
    sick: tx('Ασθένεια', 'Sick leave'),
    unpaid: tx('Άδεια άνευ αποδοχών', 'Unpaid leave'),
    wish: tx('Επιθυμία ρεπό', 'Wishes a day off'),
    unavailable: tx('Δεν μπορώ να εργαστώ', 'Cannot work'),
    swap: tx('Ανταλλαγή βάρδιας', 'Shift swap'),
  }
  const REQUEST_STATUS = {
    pending: [tx('Σε αναμονή', 'Pending'), 'warning'],
    approved: [tx('Εγκρίθηκε', 'Approved'), 'success'],
    rejected: [tx('Απορρίφθηκε', 'Rejected'), 'danger'],
    cancelled: [tx('Ακυρώθηκε', 'Withdrawn'), 'neutral'],
  }
  const RULE_TEXT = {
    coverage: tx('Λείπουν άτομα από βάρδια', 'A shift is short of people'),
    maxConsecutive: tx('Πάρα πολλές συνεχόμενες βάρδιες', 'Too many shifts in a row'),
    nightsInRow: tx('Πάνω από τις επιτρεπόμενες συνεχόμενες νύχτες', 'More nights in a row than allowed'),
    restAfterNight: tx('Λείπει ρεπό μετά από νύχτα', 'No day off after a night'),
    restHours: tx('Απόγευμα και την επομένη πρωί (κάτω από 11 ώρες ανάπαυση)', 'Afternoon then morning (under 11 hours of rest)'),
    morningToNight: tx('Πρωί ή ενδιάμεση και την επομένη νύχτα', 'Morning or intermediate followed by a night'),
    weeklyRest: tx('Εβδομάδα με λιγότερα ρεπό από τα απαιτούμενα', 'A week with fewer days off than required'),
    weekendOff: tx('Χωρίς ρεπό Σαββατοκύριακου', 'No weekend off'),
    balance: tx('Άνιση κατανομή βαρδιών', 'Uneven share of shifts'),
    personal: tx('Βάρδια που το άτομο δεν κάνει', 'A shift the person does not work'),
    maxNights: tx('Πάνω από τις νύχτες που ορίστηκαν για το άτομο', 'More nights than set for the person'),
  }
  const RULE_LABELS = {
    maxConsecutive: tx('Συνεχόμενες βάρδιες, έως (μία φορά +1)', 'Shifts in a row, at most (once +1)'),
    maxConsecutiveNights: tx('Συνεχόμενες νύχτες, έως', 'Nights in a row, at most'),
    restAfterNight: tx('Ρεπό μετά από μία νύχτα', 'Days off after one night'),
    restAfterTwoNights: tx('Ρεπό μετά από δύο νύχτες', 'Days off after two nights'),
    weeklyRestDays: tx('Ρεπό ανά εβδομάδα (μία φορά 3 και 1)', 'Days off a week (once 3 and 1)'),
    minWeekendOff: tx('Ολόκληρα Σ/Κ ρεπό, τουλάχιστον', 'Whole weekends off, at least'),
  }
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [offset, setOffset] = useState(1)
  const period = useMemo(() => rosterPeriod(new Date(), offset), [offset])
  const previous = useMemo(() => rosterPeriod(new Date(), offset - 1), [offset])
  const days = useMemo(() => periodDays(period.start, period.end), [period])
  const [savedAssignments, setSavedAssignments] = useState({})
  const [history, setHistory] = useState({ history: {}, dates: [] })
  const [requests, setRequests] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState(null)
  const [need, setNeed] = useState(null)
  const [limits, setLimits] = useState(null)
  const [panel, setPanel] = useState('')
  const [leave, setLeave] = useState({ employeeId: '', code: 'L', from: '', to: '' })
  const [ask, setAsk] = useState({ kind: 'leave', from: '', to: '', swapEmployeeId: '', swapDate: '', note: '' })
  const [dragId, setDragId] = useState(null)
  const [newShift, setNewShift] = useState({ code: '', from: '', to: '' })
  const [dropId, setDropId] = useState(null)
  const department = departments.find(d => d.id === departmentId) || null

  useEffect(() => {
    if (!tenant?.id) return
    loadRosterDepartments(tenant.id)
      .then(list => {
        // Each department sees only its own: its manager and people get their departments, the administrator all.
        let visible = list
        if (role === ROLES.DEPARTMENT_MANAGER || STAFF.has(role)) {
          const own = isDemo ? [membership?.previewDepartment].filter(Boolean) : membership?.departmentIds || []
          visible = list.filter(d => own.includes(d.id) || own.includes(d.name))
        }
        setDepartments(visible)
        setDepartmentId(current => (visible.some(d => d.id === current) ? current : visible[0]?.id || ''))
        if (!visible.length) setLoading(false)
      })
      .catch(error => notifyError(error, 'load', { operation: 'roster_departments_load' }))
  }, [tenant?.id, role, isDemo, membership?.previewDepartment, membership?.departmentIds, notifyError])

  const load = useCallback(async () => {
    if (!tenant?.id || !department) return
    setLoading(true)
    try {
      const [saved, staff, before, asked, headUserIds] = await Promise.all([
        loadRoster(tenant.id, department.id, period.start),
        loadDepartmentStaff(tenant.id, department),
        loadRosterHistory(tenant.id, department.id, previous.start),
        loadRosterRequests(tenant.id, department.id).catch(() => []),
        loadDepartmentHeadUserIds(tenant.id, department.id),
      ])
      // New people of the department join a saved roster; the head's mark and the account follow the register.
      const byId = new Map(staff.map(s => [s.employeeId, s]))
      // A saved roster keeps only the department's current staff (a physician or someone who moved away drops out).
      const staffIds = new Set(byId.keys())
      // The head: set by hand on the roster, else the department manager role (permissions), else the job position.
      let members = markHeads(
        saved
          ? [...saved.members.filter(m => byId.has(m.employeeId) || !staffIds.size), ...staff.filter(s => !saved.members.some(m => m.employeeId === s.employeeId))].map(m => ({
              ...m,
              isHead: Boolean(byId.get(m.employeeId)?.isHead),
              userId: byId.get(m.employeeId)?.userId || m.userId || null,
              // Made inactive in the register since: out of the roster, below.
              ...(byId.get(m.employeeId)?.inactiveInRegister ? { active: false } : {}),
            }))
          : staff,
        headUserIds,
        role === ROLES.DEPARTMENT_MANAGER ? user?.id : null,
      )
      const periodDates = periodDays(period.start, period.end)
      let assignments = saved?.assignments || {}
      // Approved requests of the period (leave, wishes, days they cannot work) are on the sheet.
      for (const request of asked.filter(r => r.status === 'approved' && r.kind !== 'swap')) {
        const dates = datesBetween(request.from, request.to, periodDates)
        if (!dates.length) continue
        members = members.map(m => {
          if (m.employeeId !== request.employeeId) return m
          const fixed = { ...(m.fixed || {}) }
          const wishes = { ...(m.wishes || {}) }
          for (const date of dates) {
            if (request.kind === 'wish') wishes[date] = 'R'
            else if (!fixed[date]) fixed[date] = REQUEST_CODE[request.kind]
          }
          return { ...m, fixed, wishes }
        })
        if (request.kind !== 'wish') {
          const row = { ...(assignments[request.employeeId] || {}) }
          for (const date of dates) if (!row[date] || !isLeave(row[date])) row[date] = members.find(m => m.employeeId === request.employeeId)?.fixed?.[date] || row[date]
          assignments = { ...assignments, [request.employeeId]: row }
        }
      }
      setRoster(
        saved
          ? { ...saved, demand: { ...DEMAND, ...saved.demand, overrides: saved.demand?.overrides || {} }, members, assignments }
          : { departmentId: department.id, periodStart: period.start, periodEnd: period.end, demand: DEMAND, rules: {}, members, assignments, status: 'draft', changeLog: [] },
      )
      setSavedAssignments(saved?.assignments || {})
      setHistory(before)
      setRequests(asked)
      setDirty(false)
    } catch (error) {
      notifyError(error, 'load', { operation: 'roster_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, department, period, previous, notifyError, role, user?.id])
  useEffect(() => {
    void load()
  }, [load])

  const engineEmployees = useMemo(() => (roster?.members || []).map(m => ({ id: m.employeeId, name: m.name, active: m.active !== false, fixed: m.fixed || {}, wishes: m.wishes || {}, allowed: m.allowed, extra: isExtra(m), noWeekends: Boolean(m.noWeekends), maxNights: m.maxNights, percent: m.percent })), [roster])
  const rules = useMemo(() => ({ ...DEFAULT_RULES, ...(roster?.rules || {}) }), [roster])
  const violations = useMemo(
    () => (roster ? checkRoster({ days, employees: engineEmployees, assignments: roster.assignments, demand: roster.demand, rules, history: history.history }) : []),
    [roster, days, engineEmployees, rules, history],
  )
  const targets = useMemo(() => shiftTargets(days, engineEmployees, rules.weeklyRestDays), [days, engineEmployees, rules.weeklyRestDays])
  // Who «I» am, for a member of the department's staff: their own employee row (in the Demo, the first colleague).
  const me = useMemo(() => {
    if (!staffMode || !roster) return null
    if (isDemo) return roster.members.find(m => !m.isHead) || null
    return roster.members.find(m => m.userId && m.userId === user?.id) || null
  }, [staffMode, roster, isDemo, user?.id])
  const update = next => {
    setRoster(next)
    setDirty(true)
  }
  const setMember = (employeeId, patch) => update({ ...roster, members: roster.members.map(m => (m.employeeId === employeeId ? { ...m, ...patch } : m)) })
  const setDemand = (kind, shift, value) => update({ ...roster, demand: { ...roster.demand, [kind]: { ...roster.demand[kind], [shift]: Math.max(0, Math.min(20, Number(value) || 0)) } } })
  const setRule = (key, value) => update({ ...roster, rules: { ...roster.rules, [key]: Math.max(0, Math.min(14, Number(value) || 0)) } })
  // The department's other shifts (owner, 9/11/2026): added from the hospital's codes or typed in, with their own
  // people per weekday and weekend day (0 = only by hand).
  function addOther(code, from, to) {
    const clean = String(code || '').trim()
    if (!clean || !from || !to) return
    const key = `${kindFromStart(from)}:${clean}`
    const custom = Array.isArray(roster.demand.custom) ? roster.demand.custom : []
    if (custom.some(o => o.code === key) || ['M', 'I', 'A', 'N'].includes(clean)) return
    update({ ...roster, demand: { ...roster.demand, custom: [...custom, { code: key, label: `${from}–${to}`, weekday: 0, weekend: 0 }] } })
    setNewShift({ code: '', from: '', to: '' })
  }
  const setOther = (code, patch) => update({ ...roster, demand: { ...roster.demand, custom: (roster.demand.custom || []).map(o => (o.code === code ? { ...o, ...patch } : o)) } })
  const removeOther = code => update({ ...roster, demand: { ...roster.demand, custom: (roster.demand.custom || []).filter(o => o.code !== code) } })
  function setDayNeed(date, shift, value) {
    const overrides = { ...(roster.demand.overrides || {}) }
    const own = { ...(overrides[date] || {}) }
    if (value === '' || value === null) delete own[shift]
    else own[shift] = Math.max(0, Math.min(20, Number(value) || 0))
    if (Object.keys(own).length) overrides[date] = own
    else delete overrides[date]
    update({ ...roster, demand: { ...roster.demand, overrides } })
  }

  // «Automatic»: fills the cells nobody set by hand; leave, wishes and hand-set shifts stay.
  function autoGenerate() {
    setBusy(true)
    window.setTimeout(() => {
      try {
        const result = generateRoster({ days, employees: engineEmployees, demand: roster.demand, rules, history: history.history, seed: Date.now() % 100000 })
        update({ ...roster, assignments: result.assignments })
        notify(result.violations.length ? tx(`Δημιουργήθηκε με ${result.violations.length} θέματα που χρειάζονται προσοχή.`, `Made with ${result.violations.length} issues to look at.`) : tx('Το πρόγραμμα δημιουργήθηκε· όλοι οι κανόνες τηρούνται.', 'The roster was made; every rule is kept.'), result.violations.length ? 'warning' : 'success')
      } finally {
        setBusy(false)
      }
    }, 30)
  }
  function clearAutomatic() {
    const assignments = {}
    for (const m of roster.members) assignments[m.employeeId] = { ...(m.fixed || {}) }
    update({ ...roster, assignments })
  }
  // The roster with one person's cells changed: `codes` maps dates to a code ('' clears, 'wish' toggles a wish).
  function withCodes(current, employeeId, codes) {
    const member = current.members.find(m => m.employeeId === employeeId)
    if (!member) return current
    const fixed = { ...(member.fixed || {}) }
    const wishes = { ...(member.wishes || {}) }
    const row = { ...(current.assignments[employeeId] || {}) }
    for (const [date, code] of Object.entries(codes)) {
      if (code === 'wish') {
        if (wishes[date]) delete wishes[date]
        else wishes[date] = 'R'
      } else if (code) {
        fixed[date] = code
        row[date] = code
      } else {
        delete fixed[date]
        delete row[date]
      }
    }
    return { ...current, assignments: { ...current.assignments, [employeeId]: row }, members: current.members.map(m => (m.employeeId === employeeId ? { ...m, fixed, wishes } : m)) }
  }
  function setCode(employeeId, date, code) {
    update(withCodes(roster, employeeId, { [date]: code }))
    setCell(null)
  }
  function addLeave() {
    const dates = datesBetween(leave.from, leave.to, days)
    if (!leave.employeeId || !dates.length) return
    const member = roster.members.find(m => m.employeeId === leave.employeeId)
    const codes = Object.fromEntries(dates.map(date => [date, leave.code === 'wish' ? (member.wishes?.[date] ? null : 'wish') : leave.code]).filter(([, code]) => code))
    update(withCodes(roster, leave.employeeId, codes))
    setLeave(current => ({ ...current, from: '', to: '' }))
    notify(tx(`Καταχωρίστηκαν ${dates.length} ημέρες.`, `${dates.length} days entered.`), 'success')
  }
  function dropOn(targetId) {
    if (!dragId || dragId === targetId) return
    const list = roster.members.filter(m => m.employeeId !== dragId)
    const moved = roster.members.find(m => m.employeeId === dragId)
    const at = list.findIndex(m => m.employeeId === targetId)
    list.splice(at < 0 ? list.length : at, 0, moved)
    update({ ...roster, members: headsFirst(list) })
    setDragId(null)
    setDropId(null)
  }
  // Saves; a published roster also logs every cell that changed since it was last saved.
  async function save(next = roster, message = tx('Το πρόγραμμα αποθηκεύτηκε.', 'The roster was saved.')) {
    setSaving(true)
    try {
      const logged = next.status === 'published' && next.publishedAt ? [...(next.changeLog || []), ...rosterChanges(savedAssignments, next.assignments, profile?.fullName || user?.email || '')] : next.changeLog || []
      const stored = await saveRoster(tenant.id, { ...next, changeLog: logged.slice(-500) }, user?.id)
      setRoster({ ...next, ...stored, members: next.members })
      setSavedAssignments(stored.assignments || {})
      setDirty(false)
      notify(message, 'success')
      return true
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_save' })
      return false
    } finally {
      setSaving(false)
    }
  }
  async function publish() {
    if (violations.length) {
      const ok = await confirm({ title: tx('Δημοσίευση προγράμματος', 'Publish roster'), message: tx(`Το πρόγραμμα έχει ${violations.length} θέματα. Δημοσίευση παρ' όλα αυτά;`, `The roster has ${violations.length} issues. Publish anyway?`), confirmLabel: tx('Δημοσίευση', 'Publish') })
      if (!ok) return
    }
    await save({ ...roster, status: 'published', publishedAt: new Date().toISOString() }, tx('Το πρόγραμμα δημοσιεύτηκε· το βλέπει όλο το τμήμα.', 'The roster was published; the whole department sees it.'))
  }
  const unpublish = () => save({ ...roster, status: 'draft' }, tx('Το πρόγραμμα έγινε ξανά πρόχειρο.', 'The roster is a draft again.'))
  async function remove() {
    if (!roster?.id) return
    const ok = await confirm({ title: tx('Διαγραφή προγράμματος', 'Delete roster'), message: tx('Το πρόγραμμα της περιόδου διαγράφεται οριστικά.', 'The roster of the period is deleted for good.'), confirmLabel: tx('Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try {
      await deleteRoster(tenant.id, roster)
      await load()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'roster_delete' })
    }
  }
  // The manager decides a request; an approved one goes on the sheet and the roster is saved.
  async function decide(request, status) {
    try {
      await setRosterRequestStatus(tenant.id, request.id, status, user?.id)
      let next = roster
      if (status === 'approved') {
        const dates = datesBetween(request.from, request.to, days)
        if (request.kind === 'swap') {
          const date = request.from
          const a = roster.assignments[request.employeeId]?.[date] || ''
          const b = roster.assignments[request.swapEmployeeId]?.[date] || ''
          next = withCodes(withCodes(roster, request.employeeId, { [date]: b }), request.swapEmployeeId, { [date]: a })
        } else if (dates.length) {
          next = withCodes(roster, request.employeeId, Object.fromEntries(dates.map(date => [date, request.kind === 'wish' ? 'wish' : REQUEST_CODE[request.kind]])))
        }
      }
      setRequests(list => list.map(r => (r.id === request.id ? { ...r, status } : r)))
      if (next !== roster) await save(next, tx('Εγκρίθηκε και πέρασε στο πρόγραμμα.', 'Approved and put on the roster.'))
      else notify(status === 'approved' ? tx('Το αίτημα εγκρίθηκε.', 'The request was approved.') : tx('Το αίτημα απορρίφθηκε.', 'The request was rejected.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_request_decide' })
    }
  }
  async function sendRequest() {
    if (!me || !ask.from || (ask.kind === 'swap' && !ask.swapEmployeeId)) return
    try {
      const created = await createRosterRequest(tenant.id, { departmentId: department.id, employeeId: me.employeeId, ...ask, to: ask.kind === 'swap' ? ask.from : ask.to || ask.from })
      setRequests(list => [created, ...list])
      setAsk({ kind: 'leave', from: '', to: '', swapEmployeeId: '', swapDate: '', note: '' })
      notify(tx('Το αίτημα στάλθηκε στον προϊστάμενο.', 'The request was sent to the head of the department.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_request_create' })
    }
  }
  async function withdraw(request) {
    try {
      await setRosterRequestStatus(tenant.id, request.id, 'cancelled', user?.id)
      setRequests(list => list.map(r => (r.id === request.id ? { ...r, status: 'cancelled' } : r)))
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_request_cancel' })
    }
  }

  const active = (roster?.members || []).filter(m => m.active !== false)
  const inactive = (roster?.members || []).filter(m => m.active === false)
  const nameOf = id => roster?.members.find(m => m.employeeId === id)?.name || '—'
  const codeAt = (id, date) => roster.assignments[id]?.[date] || ''
  const countOf = (id, test) => days.filter(d => test(codeAt(id, d.date))).length
  const usesI = Boolean(roster && (Number(roster.demand?.weekday?.I) || Number(roster.demand?.weekend?.I) || Object.values(roster.demand?.overrides || {}).some(o => Number(o.I)) || Object.values(roster.assignments || {}).some(row => Object.values(row || {}).includes('I'))))
  const shown = usesI ? SHIFTS : ['M', 'A', 'N']
  // The department's other shifts (owner, 9/11/2026): stored as kind:code («M:1»), shown by their own code.
  const others = customShifts(roster?.demand)
  const shortOf = code => (!code ? '' : String(code).includes(':') ? String(code).split(':')[1] : CODES[code]?.short || code)
  const labelOf = code => (String(code || '').includes(':') ? `${shortOf(code)} · ${others.find(o => o.code === code)?.label || ''} (${CODES[kindOf(code)]?.name || ''})` : CODES[code]?.label || '')
  const cellClass = code => (isLeave(code) ? 'leave' : kindOf(code) || 'none')
  const fmtDay = iso => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '')
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const hasShifts = Boolean(roster && Object.values(roster.assignments || {}).some(row => Object.values(row || {}).some(isShift)))
  const historyDays = history.dates.slice(-3).map(date => periodDays(date, date)[0])
  const published = roster?.status === 'published'
  const visible = !staffMode || published
  const pending = requests.filter(r => r.status === 'pending')
  const myRequests = staffMode && me ? requests.filter(r => r.employeeId === me.employeeId || r.swapEmployeeId === me.employeeId) : []
  const limitTag = m =>
    [
      Array.isArray(m.allowed) && m.allowed.length && m.allowed.length < SHIFTS.length ? `${tx('μόνο', 'only')} ${m.allowed.map(c => CODES[c].short).join('/')}` : '',
      isExtra(m) ? tx('υπεράριθμος', 'extra') : '',
      m.noWeekends ? tx('χωρίς Σ/Κ', 'no weekends') : '',
      m.maxNights !== undefined && m.maxNights !== null && m.maxNights !== '' ? `${tx('έως', 'max')} ${m.maxNights} ${CODES.N.short}` : '',
      Number(m.percent) > 0 && Number(m.percent) < 100 ? `${m.percent}%` : '',
    ].filter(Boolean).join(' · ')
  const toggle = name => setPanel(p => (p === name ? '' : name))

  function exportExcel() {
    const headers = [tx('Ονοματεπώνυμο', 'Name'), ...days.map(d => d.date.slice(8, 10)), ...shown.map(s => CODES[s].short), CODES.R.short, tx('Βάρδιες', 'Shifts'), tx('Στόχος', 'Target'), tx('Ώρες', 'Hours')]
    const rows = active.map(m => {
      const codes = days.map(d => codeAt(m.employeeId, d.date))
      const shifts = codes.filter(isShift).length
      return [m.name, ...codes.map(c => shortOf(c)), ...shown.map(s => codes.filter(c => kindOf(c) === s).length), codes.filter(c => c === 'R').length, shifts, targets[m.employeeId] ?? '', shifts * HOURS]
    })
    for (const s of shown) rows.push([CODES[s].name, ...days.map(d => `${active.filter(m => kindOf(codeAt(m.employeeId, d.date)) === s).length}/${demandFor(roster.demand, d)[s]}`)])
    downloadXlsx(`Programma_${(department?.name || '').replace(/\s+/g, '_')}_${period.start}.xlsx`, [{ name: department?.name || 'Roster', headers, rows }])
  }

  return (
    <Page
      fill
      className="roster-page"
      title={`${tx('Πρόγραμμα βαρδιών', 'Shift roster')}${department ? ` · ${department.name}` : ''}`}
      subtitle={`${tx('Περίοδος', 'Period')} ${fmtDay(period.start)} – ${fmtDay(period.end)} · ${active.length} ${tx('ενεργοί', 'active')}${published ? ` · ${tx('Δημοσιεύτηκε', 'Published')} ${fmtDay(roster.publishedAt)}` : roster && canEdit ? ` · ${tx('Πρόχειρο', 'Draft')}` : ''}`}
      actions={
        <>
          {dirty && canEdit && <SaveButton onClick={() => save()} loading={saving}>{tx('Αποθήκευση', 'Save')}</SaveButton>}
          {canEdit && roster && !published && (
            <Button variant={dirty || hasShifts ? 'secondary' : 'primary'} onClick={autoGenerate} loading={busy} disabled={!active.length}>
              <Wand2 size={15} aria-hidden="true" />
              {tx('Αυτόματη δημιουργία', 'Make automatically')}
            </Button>
          )}
          {canEdit && hasShifts && !published && (
            <Button variant={dirty ? 'secondary' : 'primary'} onClick={publish} disabled={saving}>
              <Megaphone size={15} aria-hidden="true" />
              {tx('Δημοσίευση', 'Publish')}
            </Button>
          )}
          {hasShifts && visible && <ExportMenu onPrint={() => window.print()} onExcel={exportExcel} />}
          {canEdit && roster && (hasShifts || roster.id) && (
            <OverflowMenu
              label={tx('Ενέργειες', 'Actions')}
              items={[
                published && { id: 'draft', label: tx('Επαναφορά σε πρόχειρο', 'Back to draft'), icon: RotateCcw, onClick: unpublish },
                hasShifts && !published && { id: 'clear', label: tx('Καθαρισμός αυτόματων βαρδιών', 'Clear the automatic shifts'), icon: Eraser, onClick: clearAutomatic },
                roster.id && { id: 'delete', label: tx('Διαγραφή προγράμματος', 'Delete roster'), icon: Trash2, tone: 'danger', separatorBefore: true, onClick: remove },
              ].filter(Boolean)}
            />
          )}
        </>
      }
    >
      <div className="roster-toolbar">
        <div className="roster-department">
          <SearchableSelect label={tx('Τμήμα', 'Department')} value={departmentId} onChange={value => value && setDepartmentId(value)} options={departments.map(d => ({ value: d.id, label: d.name }))} />
        </div>
        <div className="roster-period" role="group" aria-label={tx('Περίοδος', 'Period')}>
          <button type="button" className="roster-nav" onClick={() => setOffset(v => v - 1)} aria-label={tx('Προηγούμενη περίοδος', 'Previous period')}><ChevronLeft size={16} /></button>
          <strong>{fmtDay(period.start)} – {fmtDay(period.end)}</strong>
          <button type="button" className="roster-nav" onClick={() => setOffset(v => v + 1)} aria-label={tx('Επόμενη περίοδος', 'Next period')}><ChevronRight size={16} /></button>
        </div>
        {roster && (
          <div className="roster-tools">
            {canEdit && (
              <>
                <button type="button" className={`roster-tool${panel === 'requests' ? ' is-on' : ''}`} aria-pressed={panel === 'requests'} onClick={() => toggle('requests')}>
                  <Inbox size={15} aria-hidden="true" />
                  {tx('Αιτήματα', 'Requests')}
                  {pending.length > 0 && <span className="roster-count">{pending.length}</span>}
                </button>
                <button type="button" className={`roster-tool${panel === 'leave' ? ' is-on' : ''}`} aria-pressed={panel === 'leave'} onClick={() => toggle('leave')}>
                  <CalendarPlus size={15} aria-hidden="true" />
                  {tx('Άδειες & επιθυμίες', 'Leave & wishes')}
                </button>
                <button type="button" className={`roster-tool${panel === 'rules' ? ' is-on' : ''}`} aria-pressed={panel === 'rules'} onClick={() => toggle('rules')}>
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  {tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}
                </button>
                {published && (roster.changeLog || []).length > 0 && (
                  <button type="button" className={`roster-tool${panel === 'log' ? ' is-on' : ''}`} aria-pressed={panel === 'log'} onClick={() => toggle('log')}>
                    <History size={15} aria-hidden="true" />
                    {tx('Αλλαγές', 'Changes')}
                    <span className="roster-count is-quiet">{roster.changeLog.length}</span>
                  </button>
                )}
              </>
            )}
            {staffMode && (
              <button type="button" className={`roster-tool${panel === 'mine' ? ' is-on' : ''}`} aria-pressed={panel === 'mine'} onClick={() => toggle('mine')}>
                <Inbox size={15} aria-hidden="true" />
                {tx('Τα αιτήματά μου', 'My requests')}
              </button>
            )}
          </div>
        )}
      </div>

      {roster && canEdit && panel === 'requests' && (
        <section className="roster-panel roster-requests" aria-label={tx('Αιτήματα', 'Requests')}>
          {requests.length === 0 && <p className="roster-muted">{tx('Δεν υπάρχουν αιτήματα από το τμήμα.', 'No requests from the department.')}</p>}
          {[...pending, ...requests.filter(r => r.status !== 'pending').slice(0, 10)].map(r => (
            <div key={r.id} className="roster-request">
              <strong>{nameOf(r.employeeId)}</strong>
              <span>{REQUEST_KINDS[r.kind]}</span>
              <span>{r.kind === 'swap' ? `${fmtDay(r.from)} ${tx('με', 'with')} ${nameOf(r.swapEmployeeId)}` : r.to && r.to !== r.from ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : fmtDay(r.from)}</span>
              {r.note && <small>«{r.note}»</small>}
              {r.status === 'pending' ? (
                <span className="roster-request-actions">
                  <Button variant="secondary" onClick={() => decide(r, 'rejected')}><X size={14} aria-hidden="true" />{tx('Απόρριψη', 'Reject')}</Button>
                  <Button onClick={() => decide(r, 'approved')}><Check size={14} aria-hidden="true" />{tx('Έγκριση', 'Approve')}</Button>
                </span>
              ) : (
                <StatusBadge tone={REQUEST_STATUS[r.status][1]}>{REQUEST_STATUS[r.status][0]}</StatusBadge>
              )}
            </div>
          ))}
        </section>
      )}

      {roster && staffMode && panel === 'mine' && (
        <section className="roster-panel roster-requests" aria-label={tx('Τα αιτήματά μου', 'My requests')}>
          {!me ? (
            <p className="roster-muted">{tx('Ο λογαριασμός σας δεν έχει συνδεθεί με εργαζόμενο του τμήματος· ζητήστε το από τον διαχειριστή.', 'Your account is not linked to an employee of the department; ask the administrator.')}</p>
          ) : (
            <>
              <div className="roster-ask">
                <Field label={tx('Αίτημα', 'Request')}>
                  <select value={ask.kind} onChange={event => setAsk(current => ({ ...current, kind: event.target.value }))}>
                    {Object.entries(REQUEST_KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                  </select>
                </Field>
                <ManualDateField label={ask.kind === 'swap' ? tx('Ημέρα', 'Day') : tx('Από', 'From')} value={ask.from} onChange={value => setAsk(current => ({ ...current, from: value }))} />
                {ask.kind === 'swap' ? (
                  <Field label={tx('Με συνάδελφο', 'With colleague')}>
                    <select value={ask.swapEmployeeId} onChange={event => setAsk(current => ({ ...current, swapEmployeeId: event.target.value }))}>
                      <option value="">{tx('Επιλογή…', 'Choose…')}</option>
                      {active.filter(m => m.employeeId !== me.employeeId).map(m => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
                    </select>
                  </Field>
                ) : (
                  <ManualDateField label={tx('Έως', 'Until')} value={ask.to} onChange={value => setAsk(current => ({ ...current, to: value }))} optional />
                )}
                <Field label={tx('Σημείωση', 'Note')}>
                  <input value={ask.note} maxLength={500} onChange={event => setAsk(current => ({ ...current, note: event.target.value }))} />
                </Field>
                <Button onClick={sendRequest} disabled={!ask.from || (ask.kind === 'swap' && !ask.swapEmployeeId)}>{tx('Αποστολή', 'Send')}</Button>
              </div>
              {myRequests.map(r => (
                <div key={r.id} className="roster-request">
                  <strong>{REQUEST_KINDS[r.kind]}</strong>
                  <span>{r.kind === 'swap' ? `${fmtDay(r.from)} · ${r.employeeId === me.employeeId ? `${tx('με', 'with')} ${nameOf(r.swapEmployeeId)}` : `${tx('από', 'from')} ${nameOf(r.employeeId)}`}` : r.to && r.to !== r.from ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : fmtDay(r.from)}</span>
                  {r.note && <small>«{r.note}»</small>}
                  <StatusBadge tone={REQUEST_STATUS[r.status][1]}>{REQUEST_STATUS[r.status][0]}</StatusBadge>
                  {r.status === 'pending' && r.employeeId === me.employeeId && <Button variant="secondary" onClick={() => withdraw(r)}>{tx('Ανάκληση', 'Withdraw')}</Button>}
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {roster && canEdit && panel === 'leave' && (
        <section className="roster-panel" aria-label={tx('Άδειες & επιθυμίες', 'Leave & wishes')}>
          <Field label={tx('Εργαζόμενος', 'Employee')}>
            <select value={leave.employeeId} onChange={event => setLeave(current => ({ ...current, employeeId: event.target.value }))}>
              <option value="">{tx('Επιλογή…', 'Choose…')}</option>
              {active.map(m => <option key={m.employeeId} value={m.employeeId}>{m.name}</option>)}
            </select>
          </Field>
          <Field label={tx('Είδος', 'Type')}>
            <select value={leave.code} onChange={event => setLeave(current => ({ ...current, code: event.target.value }))}>
              {LEAVES.map(code => <option key={code} value={code}>{CODES[code].label}</option>)}
              <option value="R">{tx('Ρεπό (δεν μπορεί να εργαστεί)', 'Day off (cannot work)')}</option>
              <option value="wish">{tx('Επιθυμία ρεπό', 'Wishes days off')}</option>
            </select>
          </Field>
          <ManualDateField label={tx('Από', 'From')} value={leave.from} onChange={value => setLeave(current => ({ ...current, from: value }))} />
          <ManualDateField label={tx('Έως', 'Until')} value={leave.to} onChange={value => setLeave(current => ({ ...current, to: value }))} optional />
          <Button onClick={addLeave} disabled={!leave.employeeId || !leave.from}>{tx('Καταχώριση', 'Enter')}</Button>
        </section>
      )}

      {roster && canEdit && panel === 'rules' && (
        <ObserverDialog
          title={tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}
          width="wide"
          className="roster-rules-dialog"
          onClose={() => setPanel('')}
          footer={<SaveButton onClick={async () => { if (await save()) setPanel('') }} loading={saving} disabled={!dirty}>{tx('Αποθήκευση', 'Save')}</SaveButton>}
        >
        <section className="roster-panel roster-panel-rules" aria-label={tx('Άτομα ανά βάρδια & κανόνες', 'People per shift & rules')}>
          <div className="roster-col">
          <b className="roster-col-title">{tx('Άτομα ανά βάρδια', 'People per shift')}</b>
          <div className="roster-demand">
            <span />
            <b>{tx('Καθημ.', 'Weekday')}</b>
            <b>{tx('Σ/Κ', 'Weekend')}</b>
            {SHIFTS.map(s => (
              <div key={s} className="roster-demand-row">
                <span>{CODES[s].label}</span>
                {['weekday', 'weekend'].map(kind => (
                  <input key={kind} type="number" min="0" max="20" aria-label={`${CODES[s].label} ${kind === 'weekday' ? tx('καθημερινή', 'weekday') : tx('Σαββατοκύριακο', 'weekend')}`} value={roster.demand?.[kind]?.[s] ?? 0} onChange={event => setDemand(kind, s, event.target.value)} />
                ))}
              </div>
            ))}
          </div>
          </div>
          <div className="roster-others">
            <b>{tx('Άλλες βάρδιες του τμήματος', 'Other shifts of the department')}</b>
            {customShifts(roster.demand).length > 0 && (
              <div className="roster-other roster-other-head" aria-hidden="true">
                <span />
                <span />
                <b>{tx('Καθημ.', 'Weekday')}</b>
                <b>{tx('Σ/Κ', 'Weekend')}</b>
                <span />
              </div>
            )}
            {customShifts(roster.demand).map(o => (
              <div key={o.code} className="roster-other">
                <i className={`code-${kindOf(o.code)}`}>{o.code.split(':')[1]}</i>
                <span>{o.label} · {CODES[kindOf(o.code)]?.name}</span>
                {['weekday', 'weekend'].map(kind => (
                  <input key={kind} type="number" min="0" max="20" aria-label={`${o.code.split(':')[1]} ${kind === 'weekday' ? tx('καθημερινή', 'weekday') : tx('Σαββατοκύριακο', 'weekend')}`} value={o[kind] ?? 0} onChange={event => setOther(o.code, { [kind]: Math.max(0, Math.min(20, Number(event.target.value) || 0)) })} />
                ))}
                <button type="button" className="roster-other-remove" aria-label={tx(`Αφαίρεση βάρδιας ${o.code.split(':')[1]}`, `Remove shift ${o.code.split(':')[1]}`)} onClick={() => removeOther(o.code)}>×</button>
              </div>
            ))}
            {codeStyle === 'iaso' ? (
              <SearchableSelect
                label={tx('Προσθήκη από τους κωδικούς του νοσοκομείου', 'Add from the hospital’s codes')}
                placeholder={tx('Επιλέξτε κωδικό…', 'Choose a code…')}
                value=""
                onChange={value => {
                  const row = IASO_SHIFT_CODES.find(([code]) => code === value)
                  if (row) addOther(row[0], row[1], row[2])
                }}
                options={IASO_SHIFT_CODES.filter(([code]) => !['4', '12', '19', '20'].includes(code)).map(([code, from, to]) => ({ value: code, label: `${code} · ${from}–${to}` }))}
              />
            ) : (
              <div className="roster-other-new">
                <Field label={tx('Κωδικός', 'Code')}>
                  <input value={newShift.code} maxLength={6} onChange={event => setNewShift(current => ({ ...current, code: event.target.value }))} />
                </Field>
                <TimeField label={tx('Από', 'From')} value={newShift.from} onChange={value => setNewShift(current => ({ ...current, from: value }))} />
                <TimeField label={tx('Έως', 'Until')} value={newShift.to} onChange={value => setNewShift(current => ({ ...current, to: value }))} />
                <Button variant="secondary" onClick={() => addOther(newShift.code, newShift.from, newShift.to)} disabled={!newShift.code || !newShift.from || !newShift.to}>{tx('Προσθήκη', 'Add')}</Button>
              </div>
            )}
            <p className="roster-muted">{tx('Μετράει στην κατηγορία της (από την ώρα έναρξης)· με αριθμό ατόμων τη βάζει και η αυτόματη δημιουργία, με 0 μόνο με το χέρι.', 'Counts in its kind (by its start); with a number of people the automatic roster places it too, with 0 only by hand.')}</p>
          </div>
          <div className="roster-rule-list">
            <b className="roster-col-title">{tx('Κανόνες', 'Rules')}</b>
            <div className="roster-rule">
              <span>{tx('Κωδικοί βαρδιών', 'Shift codes')}</span>
              <select aria-label={tx('Κωδικοί βαρδιών', 'Shift codes')} value={codeStyle} onChange={event => update({ ...roster, rules: { ...roster.rules, codes: event.target.value } })}>
                <option value="letters">{tx('Γράμματα (Π, Α, Ν, Ρ)', 'Letters (M, A, N, R)')}</option>
                <option value="iaso">{tx('Αριθμοί μισθοδοσίας (4, 19, 20, R)', 'Payroll numbers (4, 19, 20, R)')}</option>
              </select>
            </div>
            {RULE_FIELDS.map(key => (
              <div key={key} className="roster-rule">
                <span>{RULE_LABELS[key]}</span>
                <input type="number" min="0" max="14" aria-label={RULE_LABELS[key]} value={rules[key]} onChange={event => setRule(key, event.target.value)} />
              </div>
            ))}
            <p className="roster-muted">{tx('Πάντα: όχι απόγευμα → πρωί (11 ώρες ανάπαυση), όχι πρωί/ενδιάμεση → νύχτα· ίσες βάρδιες, νύχτες και Σ/Κ· ρεπό κατά προτίμηση ανά δύο. Με κλικ σε όνομα: ποιες βάρδιες κάνει το άτομο.', 'Always: no afternoon → morning (11 hours of rest), no morning/intermediate → night; even shifts, nights and weekends; days off preferably in pairs. Click a name: the shifts that person works.')}</p>
          </div>
        </section>
        </ObserverDialog>
      )}

      {roster && canEdit && panel === 'log' && (
        <section className="roster-panel roster-log" aria-label={tx('Αλλαγές μετά τη δημοσίευση', 'Changes after publishing')}>
          <ul>
            {[...(roster.changeLog || [])].reverse().slice(0, 60).map((entry, index) => (
              <li key={`${entry.at}-${entry.employeeId}-${entry.date}-${index}`}>
                <span>{fmtDay(entry.at)}</span>
                <strong>{nameOf(entry.employeeId)}</strong>
                <span>{fmtDay(entry.date)}: {CODES[entry.from]?.short || '—'} → {CODES[entry.to]?.short || '—'}</span>
                {entry.by && <small>{entry.by}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="inline-empty">{tx('Φόρτωση…', 'Loading…')}</div>
      ) : !roster ? (
        <div className="inline-empty">{tx('Δεν υπάρχει τμήμα για πρόγραμμα βαρδιών.', 'No department to make a roster for.')}</div>
      ) : !visible ? (
        <div className="inline-empty">{tx('Το πρόγραμμα της περιόδου δεν έχει δημοσιευτεί ακόμη. Μπορείτε να στείλετε αιτήματα από τα «Αιτήματά μου».', 'The roster of the period is not published yet. You can send requests from «My requests».')}</div>
      ) : (
        <section className="roster-sheet">
          <div className="roster-grid-wrap">
            <table className="roster-grid">
              <thead>
                <tr>
                  <th className="roster-name-col">{tx('Εργαζόμενος', 'Employee')}</th>
                  {historyDays.map(d => (
                    <th key={d.date} className="roster-history" title={tx('Τέλος προηγούμενης περιόδου', 'End of the previous period')}>
                      {weekdays[d.weekday]}
                      <br />
                      {d.date.slice(8, 10)}
                    </th>
                  ))}
                  {days.map(d => (
                    <th key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                      {weekdays[d.weekday]}
                      <br />
                      {d.date.slice(8, 10)}
                    </th>
                  ))}
                  {shown.map(s => <th key={s} className="roster-sum">{CODES[s].short}</th>)}
                  <th className="roster-sum">{CODES.R.short}</th>
                  <th className="roster-sum roster-total-col">{tx('Βάρδιες / στόχος', 'Shifts / target')}</th>
                  <th className="roster-sum roster-total-col">{tx('Ώρες', 'Hours')}</th>
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td className="roster-empty" colSpan={days.length + historyDays.length + shown.length + 4}>{tx('Το τμήμα δεν έχει εργαζόμενους στο μητρώο.', 'The department has no employees in the register.')}</td>
                  </tr>
                )}
                {active.map(m => {
                  const shifts = countOf(m.employeeId, isShift)
                  const target = targets[m.employeeId] ?? 0
                  const tag = limitTag(m)
                  return (
                    <tr
                      key={m.employeeId}
                      className={`${dragId === m.employeeId ? 'is-dragging' : ''}${dropId === m.employeeId && dragId && dragId !== m.employeeId ? ' is-drop-target' : ''}${m.isHead ? ' is-head' : ''}${me?.employeeId === m.employeeId ? ' is-me' : ''}`}
                      onDragOver={event => {
                        if (!dragId || m.isHead) return
                        event.preventDefault()
                        if (dropId !== m.employeeId) setDropId(m.employeeId)
                      }}
                      onDrop={() => dropOn(m.employeeId)}
                    >
                      <td className="roster-name-col">
                        <span className="roster-name">
                          {canEdit && !m.isHead ? (
                            <span className="roster-grip" draggable onDragStart={() => setDragId(m.employeeId)} onDragEnd={() => { setDragId(null); setDropId(null) }} title={tx('Σύρετε για αλλαγή σειράς', 'Drag to reorder')} aria-hidden="true">
                              <GripVertical size={14} />
                            </span>
                          ) : (
                            <span className="roster-grip is-fixed" aria-hidden="true" />
                          )}
                          {canEdit && <input type="checkbox" checked aria-label={tx(`${m.name}: ενεργός στο πρόγραμμα`, `${m.name}: in the roster`)} onChange={() => setMember(m.employeeId, { active: false })} />}
                          {canEdit ? (
                            <button
                              type="button"
                              className="roster-name-text"
                              title={tx('Ποιες βάρδιες κάνει', 'Which shifts this person works')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setCell(null)
                                setNeed(null)
                                setLimits({ employeeId: m.employeeId, top: Math.min(rect.bottom + 4, window.innerHeight - 220), left: rect.left })
                              }}
                            >
                              {m.name}
                            </button>
                          ) : (
                            <span className="roster-name-text">{m.name}</span>
                          )}
                          {m.isHead && <small className="roster-head-tag">{tx('Προϊστ.', 'Head')}</small>}
                          {tag && <small className="roster-limit-tag">{tag}</small>}
                        </span>
                      </td>
                      {historyDays.map(d => {
                        const code = history.history[m.employeeId]?.[history.dates.indexOf(d.date)] || ''
                        return <td key={d.date} className="roster-history"><span className={`roster-cell is-past code-${cellClass(code)}`}>{shortOf(code)}</span></td>
                      })}
                      {days.map(d => {
                        const code = codeAt(m.employeeId, d.date)
                        const wish = m.wishes?.[d.date]
                        const manual = Boolean(m.fixed?.[d.date]) && isShift(code)
                        const bad = canEdit && violations.some(v => v.employeeId === m.employeeId && v.date === d.date)
                        return (
                          <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                            <button
                              type="button"
                              className={`roster-cell code-${cellClass(code)}${wish ? ' has-wish' : ''}${bad ? ' is-bad' : ''}${manual && canEdit ? ' is-manual' : ''}`}
                              disabled={!canEdit}
                              aria-label={`${m.name} ${fmtDay(d.date)}: ${[labelOf(code) || tx('κενό', 'empty'), wish && tx('επιθυμία ρεπό', 'wishes a day off')].filter(Boolean).join(' · ')}`}
                              title={[labelOf(code), wish && tx('επιθυμία ρεπό', 'wishes a day off'), manual && tx('ορίστηκε με το χέρι', 'set by hand')].filter(Boolean).join(' · ')}
                              onClick={event => {
                                const rect = event.currentTarget.getBoundingClientRect()
                                setNeed(null)
                                setLimits(null)
                                setCell({ employeeId: m.employeeId, date: d.date, top: Math.min(rect.bottom + 4, window.innerHeight - 380), left: Math.min(rect.left, window.innerWidth - 230) })
                              }}
                            >
                              {code ? shortOf(code) : wish ? '★' : ''}
                            </button>
                          </td>
                        )
                      })}
                      {shown.map(s => <td key={s} className="roster-sum">{countOf(m.employeeId, c => kindOf(c) === s)}</td>)}
                      <td className="roster-sum">{countOf(m.employeeId, c => c === 'R')}</td>
                      <td className={`roster-sum roster-total-col${hasShifts && Math.abs(shifts - target) > rules.balanceTolerance ? ' is-off-target' : ''}`}>
                        {shifts} / {target}
                      </td>
                      <td className="roster-sum roster-total-col">{shifts * HOURS} / {target * HOURS}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {shown.map(s => (
                  <tr key={s} className="roster-coverage">
                    <th className="roster-name-col" scope="row">{CODES[s].name}</th>
                    {historyDays.map(d => <td key={d.date} className="roster-history" />)}
                    {days.map(d => {
                      const have = active.filter(m => !isExtra(m) && kindOf(codeAt(m.employeeId, d.date)) === s).length
                      const extra = active.filter(m => isExtra(m) && kindOf(codeAt(m.employeeId, d.date)) === s).length
                      const needed = demandFor(roster.demand, d)[s]
                      const own = roster.demand.overrides?.[d.date]?.[s] !== undefined
                      return (
                        <td key={d.date} className={d.weekend ? 'is-weekend' : ''}>
                          <button
                            type="button"
                            className={`roster-need${hasShifts && have + extra < needed ? ' is-short' : ''}${own ? ' is-own' : ''}`}
                            title={extra ? tx('Μαζί με τον προϊστάμενο', 'Head of the department included') : undefined}
                            disabled={!canEdit}
                            aria-label={`${CODES[s].name} ${fmtDay(d.date)}: ${have} ${tx('από', 'of')} ${needed}`}
                            onClick={event => {
                              const rect = event.currentTarget.getBoundingClientRect()
                              setCell(null)
                              setLimits(null)
                              setNeed({ date: d.date, shift: s, value: String(needed), top: Math.max(8, rect.top - 124), left: Math.min(rect.left, window.innerWidth - 230) })
                            }}
                          >
                            {/* The head counts on the shift like everyone else (owner, 9/11/2026). */}
                            {have + extra}/{needed}
                          </button>
                        </td>
                      )
                    })}
                    <td className="roster-sum" colSpan={shown.length + 3} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
          {canEdit && inactive.length > 0 && (
            <p className="roster-inactive">
              {tx('Εκτός προγράμματος:', 'Out of the roster:')}{' '}
              {inactive.map(m => (
                <label key={m.employeeId}>
                  <input type="checkbox" checked={false} onChange={() => setMember(m.employeeId, { active: true })} />
                  {m.name}
                </label>
              ))}
            </p>
          )}
          <div className="roster-legend">
            {shown.map(c => <span key={c}><i className={`code-${c}`}>{CODES[c].short}</i>{CODES[c].label}</span>)}
            {others.map(o => <span key={o.code}><i className={`code-${kindOf(o.code)}`}>{shortOf(o.code)}</i>{o.label}</span>)}
            <span><i className="code-R">{CODES.R.short}</i>{CODES.R.label}</span>
            <span><i className="code-leave">{CODES.L.short}</i>{tx('Άδεια / αργία', 'Leave / holiday')}</span>
            <span><i className="code-wish">★</i>{tx('Επιθυμία ρεπό', 'Wishes a day off')}</span>
            {canEdit && <span><i className="code-none is-manual-key" />{tx('Ορίστηκε με το χέρι', 'Set by hand')}</span>}
          </div>
          {canEdit &&
            hasShifts &&
            (violations.length === 0 ? (
              <p className="roster-ok">✓ {tx('Όλοι οι κανόνες τηρούνται.', 'Every rule is kept.')}</p>
            ) : (
              <ul className="roster-violations">
                {/* One line per rule: the first days and the people (their cells are framed red). */}
                {Object.entries(violations.reduce((acc, v) => ({ ...acc, [v.rule]: [...(acc[v.rule] || []), v] }), {})).map(([rule, list]) => {
                  const dates = [...new Set(list.map(v => v.date).filter(Boolean))]
                  const people = [...new Set(list.map(v => nameOf(v.employeeId)).filter(name => name !== '—'))]
                  return (
                    <li key={rule}>
                      <strong>{RULE_TEXT[rule] || rule}</strong>
                      {dates.length > 0 && ` · ${dates.slice(0, 6).map(fmtDay).join(', ')}${dates.length > 6 ? tx(` και ${dates.length - 6} ακόμη`, ` and ${dates.length - 6} more`) : ''}`}
                      {people.length > 0 && ` · ${people.slice(0, 3).join(', ')}${people.length > 3 ? '…' : ''}`}
                    </li>
                  )
                })}
              </ul>
            ))}
        </section>
      )}

      {cell && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setCell(null)} aria-hidden="true" />
          <div className="roster-cell-menu" role="menu" style={{ top: cell.top, left: cell.left }}>
            {[...SHIFTS, 'R', ...LEAVES].map(code => (
              <button key={code} type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, code)}>
                <i className={`code-${LEAVES.includes(code) ? 'leave' : code}`}>{CODES[code].short}</i>
                {CODES[code].label}
              </button>
            ))}
            {others.map(o => (
              <button key={o.code} type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, o.code)}>
                <i className={`code-${kindOf(o.code)}`}>{shortOf(o.code)}</i>
                {o.label} · {CODES[kindOf(o.code)]?.name}
              </button>
            ))}
            <button type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, 'wish')}>
              <i className="code-wish">★</i>
              {tx('Επιθυμία ρεπό', 'Wishes a day off')}
            </button>
            <button type="button" role="menuitem" onClick={() => setCode(cell.employeeId, cell.date, '')}>
              <i className="code-none">–</i>
              {tx('Καθαρισμός', 'Clear')}
            </button>
          </div>
        </>
      )}
      {need && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setNeed(null)} aria-hidden="true" />
          <div className="roster-cell-menu roster-need-menu" role="dialog" aria-label={`${CODES[need.shift].name} ${fmtDay(need.date)}`} style={{ top: need.top, left: need.left }}>
            <label>
              <span>{CODES[need.shift].name} {fmtDay(need.date)} · {tx('χρειάζονται', 'needed')}</span>
              <input type="number" min="0" max="20" value={need.value} onChange={event => setNeed(current => ({ ...current, value: event.target.value }))} />
            </label>
            <div className="roster-need-actions">
              <button type="button" onClick={() => { setDayNeed(need.date, need.shift, null); setNeed(null) }}>{tx('Όπως οι άλλες μέρες', 'Like the other days')}</button>
              <button type="button" className="is-primary" onClick={() => { setDayNeed(need.date, need.shift, need.value); setNeed(null) }}>{tx('Ορισμός', 'Set')}</button>
            </div>
          </div>
        </>
      )}
      {limits && (
        <>
          <div className="roster-cell-backdrop" onClick={() => setLimits(null)} aria-hidden="true" />
          <div className="roster-cell-menu roster-limits-menu" role="dialog" aria-label={tx('Βάρδιες που κάνει', 'Shifts this person works')} style={{ top: limits.top, left: limits.left }}>
            <p>{nameOf(limits.employeeId)}</p>
            <label className="roster-limit roster-head-choice">
              <input
                type="checkbox"
                checked={Boolean(roster.members.find(m => m.employeeId === limits.employeeId)?.isHead)}
                onChange={event => update({ ...roster, members: headsFirst(roster.members.map(m => (m.employeeId === limits.employeeId ? { ...m, headSet: event.target.checked, isHead: event.target.checked } : m))) })}
              />
              {tx('Προϊστάμενος/η τμήματος (πρώτος στη λίστα)', 'Head of the department (first in the list)')}
            </label>
            {(() => {
              const member = roster.members.find(m => m.employeeId === limits.employeeId)
              if (!member) return null
              return (
                <>
                  <label className="roster-limit">
                    <input type="checkbox" checked={isExtra(member)} onChange={event => setMember(member.employeeId, { extra: event.target.checked })} />
                    {tx('Υπεράριθμος: δεν μετράει στις βάρδιες (μόνο αν δεν βγαίνει το πρόγραμμα)', 'Supernumerary: not counted in the shifts (only if the roster cannot be made otherwise)')}
                  </label>
                  <label className="roster-limit">
                    <input type="checkbox" checked={Boolean(member.noWeekends)} onChange={event => setMember(member.employeeId, { noWeekends: event.target.checked })} />
                    {tx('Χωρίς Σαββατοκύριακα', 'No weekends')}
                  </label>
                  <label className="roster-limit roster-limit-number">
                    <span>{tx('Νύχτες την περίοδο, έως', 'Nights in the period, at most')}</span>
                    <input type="number" min="0" max="31" placeholder="—" value={member.maxNights ?? ''} onChange={event => setMember(member.employeeId, { maxNights: event.target.value === '' ? undefined : Math.max(0, Math.min(31, Number(event.target.value) || 0)) })} />
                  </label>
                  <label className="roster-limit roster-limit-number">
                    <span>{tx('Απασχόληση %', 'Working time %')}</span>
                    <input type="number" min="10" max="100" step="5" placeholder="100" value={member.percent ?? ''} onChange={event => setMember(member.employeeId, { percent: event.target.value === '' ? undefined : Math.max(10, Math.min(100, Number(event.target.value) || 100)) })} />
                  </label>
                </>
              )
            })()}
            <p className="roster-limits-title">{tx('Βάρδιες που κάνει', 'Shifts worked')}</p>
            {SHIFTS.map(code => {
              const member = roster.members.find(m => m.employeeId === limits.employeeId)
              const allowed = Array.isArray(member?.allowed) && member.allowed.length ? member.allowed : SHIFTS
              const on = allowed.includes(code)
              return (
                <label key={code} className="roster-limit">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on ? allowed.filter(c => c !== code) : [...allowed, code]
                      if (!next.length) return
                      setMember(limits.employeeId, { allowed: next.length === SHIFTS.length ? undefined : SHIFTS.filter(c => next.includes(c)) })
                    }}
                  />
                  <i className={`code-${code}`}>{CODES[code].short}</i>
                  {CODES[code].label}
                </label>
              )
            })}
          </div>
        </>
      )}
    </Page>
  )
}
