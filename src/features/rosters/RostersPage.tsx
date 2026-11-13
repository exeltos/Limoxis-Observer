import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Eraser, History, Inbox, Megaphone, RotateCcw, SlidersHorizontal, Trash2, Wand2, X } from 'lucide-react'
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
import { StatusBadge } from '../../design-system/StatusBadge'
import { downloadXlsx } from '../../core/export/xlsxExport'
import { printReport } from '../../core/export/reportDocument'
import { rosterDocument, rosterSheet } from './rosterExport'
import { DEFAULT_RULES, checkRoster, customShifts, datesBetween, demandFor, generateRoster, isLeave, isShift, kindFromStart, kindOf, periodDays, shiftTargets } from './rosterEngine'
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
import { DEMAND, HOURS, LEAVES, REQUEST_CODE, SHIFTS, isExtra } from './rosterPageModel'
import { RosterSheet } from './RosterSheet'
import { RosterMyRequests, RosterPopovers, RosterRulesDialog } from './RosterPanels'
import type { Assignments, CustomShift, DemandKind, RosterDay, RosterHistory, ShiftNeed } from './rosterRules'
import type { Roster, RosterDepartment, RosterMember, RosterRequest } from './rosterService'
import type { RosterCodes, RosterView } from './rosterPageModel'
import './rosters.css'

// The department's monthly shift roster (owner, 8/11/2026). It opens as an empty sheet with every name, so leave and
// wishes go in first; «Αυτόματη δημιουργία» fills only the empty cells (what was set by hand stays). Under each day the
// people on each shift against those needed (a click sets the day's own number); beside each person their totals,
// hours and target. The head of the department is first, the others are dragged into the order of priority; a click
// on a name sets the shifts that person may take. The new roster starts from the end of the previous one.
// The department's people send requests (leave, a day off, a day they cannot work, a swap) and see the roster once it
// is published; every change after publishing is logged.
const WRITERS: Set<unknown> = new Set([ROLES.HOSPITAL_ADMIN, ROLES.DEPARTMENT_MANAGER, ROLES.DEMO, ROLES.PLATFORM_OWNER])
const STAFF: Set<unknown> = new Set([ROLES.DEPARTMENT_USER, ROLES.LINK_NURSE])

export function RostersPage() {
  const { user, profile } = useAuth()
  const { tenant, role, membership, isDemo } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  const tx = (elText: string, enText: string) => (en ? enText : elText)
  const canEdit = WRITERS.has(role)
  const staffMode = !canEdit && STAFF.has(role)
  // The Division Director reads the rosters and requests of the division's departments: nothing to approve, edit or publish.
  const overseer = role === ROLES.DIVISION_DIRECTOR
  const [roster, setRoster] = useState<Roster | null>(null)
  // The codes on the sheet: letters, or the hospital's own payroll numbers (ΙΑΣΩ: 4, 12, 19, 20, R, Α, Γ, Κ, B, as in
  // its Excel); chosen per department in the rules, by default the numbers in ΙΑΣΩ (owner, 8/11/2026).
  const codeStyle = roster?.rules?.codes || (/ΙΑΣΩ|IASO/i.test(tenant?.name || '') ? 'iaso' : 'letters')
  const CODES = useMemo((): RosterCodes => {
    const iaso = codeStyle === 'iaso'
    const short = (letters: string, number: string) => (iaso ? number : letters)
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
  const REQUEST_KINDS: Record<string, string> = {
    leave: tx('Κανονική άδεια', 'Annual leave'),
    sick: tx('Ασθένεια', 'Sick leave'),
    unpaid: tx('Άδεια άνευ αποδοχών', 'Unpaid leave'),
    wish: tx('Επιθυμία ρεπό', 'Wishes a day off'),
    unavailable: tx('Δεν μπορώ να εργαστώ', 'Cannot work'),
    swap: tx('Ανταλλαγή βάρδιας', 'Shift swap'),
  }
  const REQUEST_STATUS: Record<string, [string, string]> = {
    pending: [tx('Σε αναμονή', 'Pending'), 'warning'],
    approved: [tx('Εγκρίθηκε', 'Approved'), 'success'],
    rejected: [tx('Απορρίφθηκε', 'Rejected'), 'danger'],
    cancelled: [tx('Ακυρώθηκε', 'Withdrawn'), 'neutral'],
  }
  const RULE_TEXT: Record<string, string> = {
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
  const RULE_LABELS: Record<string, string> = {
    maxConsecutive: tx('Συνεχόμενες βάρδιες, έως (μία φορά +1)', 'Shifts in a row, at most (once +1)'),
    maxConsecutiveNights: tx('Συνεχόμενες νύχτες, έως', 'Nights in a row, at most'),
    restAfterNight: tx('Ρεπό μετά από μία νύχτα', 'Days off after one night'),
    restAfterTwoNights: tx('Ρεπό μετά από δύο νύχτες', 'Days off after two nights'),
    weeklyRestDays: tx('Ρεπό ανά εβδομάδα (μία φορά 3 και 1)', 'Days off a week (once 3 and 1)'),
    minWeekendOff: tx('Ολόκληρα Σ/Κ ρεπό, τουλάχιστον', 'Whole weekends off, at least'),
  }
  const [departments, setDepartments] = useState<RosterDepartment[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [offset, setOffset] = useState(1)
  const period = useMemo(() => rosterPeriod(new Date(), offset), [offset])
  const previous = useMemo(() => rosterPeriod(new Date(), offset - 1), [offset])
  const days = useMemo(() => periodDays(period.start, period.end), [period])
  const [savedAssignments, setSavedAssignments] = useState<Assignments>({})
  const [history, setHistory] = useState<{ history: RosterHistory, dates: string[] }>({ history: {}, dates: [] })
  const [requests, setRequests] = useState<RosterRequest[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cell, setCell] = useState<{ employeeId: string, date: string, top: number, left: number } | null>(null)
  const [need, setNeed] = useState<{ date: string, shift: string, value: string, top: number, left: number } | null>(null)
  const [limits, setLimits] = useState<{ employeeId: string, top: number, left: number } | null>(null)
  const [panel, setPanel] = useState('')
  const [leave, setLeave] = useState({ employeeId: '', code: 'L', from: '', to: '' })
  const [ask, setAsk] = useState({ kind: 'leave', from: '', to: '', swapEmployeeId: '', swapDate: '', note: '' })
  const [dragId, setDragId] = useState<string | null>(null)
  const [newShift, setNewShift] = useState({ code: '', from: '', to: '' })
  const [dropId, setDropId] = useState<string | null>(null)
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
        // The Division Director: the departments of the division (in the sample data by name).
        if (role === ROLES.DIVISION_DIRECTOR) {
          const own = membership?.departmentIds || []
          visible = list.filter(d => own.includes(d.id) || own.includes(d.name))
        }
        setDepartments(visible)
        // ?department=<id>: the department opened from the Division Director's home.
        const asked = new URLSearchParams(window.location.search).get('department')
        setDepartmentId(current => (visible.some(d => d.id === current) ? current : visible.find(d => d.id === asked)?.id || visible[0]?.id || ''))
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
  // The actions below run once the roster has loaded (the sheet and its menus show only then).
  const loaded = roster as Roster
  const update = (next: Roster) => {
    setRoster(next)
    setDirty(true)
  }
  const setMember = (employeeId: string, patch: Partial<RosterMember>) => update({ ...loaded, members: loaded.members.map(m => (m.employeeId === employeeId ? { ...m, ...patch } : m)) })
  const setDemand = (kind: DemandKind, shift: string, value: unknown) => update({ ...loaded, demand: { ...loaded.demand, [kind]: { ...loaded.demand[kind], [shift]: Math.max(0, Math.min(20, Number(value) || 0)) } } })
  const setRule = (key: string, value: unknown) => update({ ...loaded, rules: { ...loaded.rules, [key]: Math.max(0, Math.min(14, Number(value) || 0)) } })
  // The department's other shifts (owner, 9/11/2026): added from the hospital's codes or typed in, with their own
  // people per weekday and weekend day (0 = only by hand).
  function addOther(code: unknown, from: string, to: string) {
    const clean = String(code || '').trim()
    if (!clean || !from || !to) return
    const key = `${kindFromStart(from)}:${clean}`
    const custom = Array.isArray(loaded.demand.custom) ? loaded.demand.custom : []
    if (custom.some(o => o.code === key) || ['M', 'I', 'A', 'N'].includes(clean)) return
    update({ ...loaded, demand: { ...loaded.demand, custom: [...custom, { code: key, label: `${from}–${to}`, weekday: 0, weekend: 0 }] } })
    setNewShift({ code: '', from: '', to: '' })
  }
  const setOther = (code: string, patch: Partial<CustomShift>) => update({ ...loaded, demand: { ...loaded.demand, custom: (loaded.demand.custom || []).map((o: CustomShift) => (o.code === code ? { ...o, ...patch } : o)) } })
  const removeOther = (code: string) => update({ ...loaded, demand: { ...loaded.demand, custom: (loaded.demand.custom || []).filter((o: CustomShift) => o.code !== code) } })
  function setDayNeed(date: string, shift: string, value: string | null) {
    const overrides = { ...(loaded.demand.overrides || {}) }
    const own = { ...(overrides[date] || {}) }
    if (value === '' || value === null) delete own[shift]
    else own[shift] = Math.max(0, Math.min(20, Number(value) || 0))
    if (Object.keys(own).length) overrides[date] = own
    else delete overrides[date]
    update({ ...loaded, demand: { ...loaded.demand, overrides } })
  }

  // «Automatic»: fills the cells nobody set by hand; leave, wishes and hand-set shifts stay.
  function autoGenerate() {
    setBusy(true)
    window.setTimeout(() => {
      try {
        const result = generateRoster({ days, employees: engineEmployees, demand: loaded.demand, rules, history: history.history, seed: Date.now() % 100000 })
        update({ ...loaded, assignments: result.assignments })
        notify(result.violations.length ? tx(`Δημιουργήθηκε με ${result.violations.length} θέματα που χρειάζονται προσοχή.`, `Made with ${result.violations.length} issues to look at.`) : tx('Το πρόγραμμα δημιουργήθηκε· όλοι οι κανόνες τηρούνται.', 'The roster was made; every rule is kept.'), result.violations.length ? 'warning' : 'success')
      } finally {
        setBusy(false)
      }
    }, 30)
  }
  function clearAutomatic() {
    const assignments: Assignments = {}
    for (const m of loaded.members) assignments[m.employeeId] = { ...(m.fixed || {}) }
    update({ ...loaded, assignments })
  }
  // The roster with one person's cells changed: `codes` maps dates to a code ('' clears, 'wish' toggles a wish).
  function withCodes(current: Roster, employeeId: string, codes: Record<string, string>): Roster {
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
  function setCode(employeeId: string, date: string, code: string) {
    update(withCodes(loaded, employeeId, { [date]: code }))
    setCell(null)
  }
  function addLeave() {
    const dates = datesBetween(leave.from, leave.to, days)
    if (!leave.employeeId || !dates.length) return
    const member = loaded.members.find(m => m.employeeId === leave.employeeId)
    const codes = Object.fromEntries(dates.map(date => [date, leave.code === 'wish' ? ((member as RosterMember).wishes?.[date] ? null : 'wish') : leave.code]).filter(([, code]) => code))
    update(withCodes(loaded, leave.employeeId, codes))
    setLeave(current => ({ ...current, from: '', to: '' }))
    notify(tx(`Καταχωρίστηκαν ${dates.length} ημέρες.`, `${dates.length} days entered.`), 'success')
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    const list = loaded.members.filter(m => m.employeeId !== dragId)
    const moved = loaded.members.find(m => m.employeeId === dragId)
    const at = list.findIndex(m => m.employeeId === targetId)
    list.splice(at < 0 ? list.length : at, 0, moved as RosterMember)
    update({ ...loaded, members: headsFirst(list) })
    setDragId(null)
    setDropId(null)
  }
  // Saves; a published roster also logs every cell that changed since it was last saved.
  async function save(next: Roster = roster as Roster, message = tx('Το πρόγραμμα αποθηκεύτηκε.', 'The roster was saved.')) {
    setSaving(true)
    try {
      const logged = next.status === 'published' && next.publishedAt ? [...(next.changeLog || []), ...rosterChanges(savedAssignments, next.assignments, profile?.fullName || user?.email || '')] : next.changeLog || []
      const stored = await saveRoster((tenant?.id as string), { ...next, changeLog: logged.slice(-500) }, user?.id)
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
    await save({ ...loaded, status: 'published', publishedAt: new Date().toISOString() }, tx('Το πρόγραμμα δημοσιεύτηκε· το βλέπει όλο το τμήμα.', 'The roster was published; the whole department sees it.'))
  }
  const unpublish = () => save({ ...loaded, status: 'draft' }, tx('Το πρόγραμμα έγινε ξανά πρόχειρο.', 'The roster is a draft again.'))
  async function remove() {
    if (!roster?.id) return
    const ok = await confirm({ title: tx('Διαγραφή προγράμματος', 'Delete roster'), message: tx('Το πρόγραμμα της περιόδου διαγράφεται οριστικά.', 'The roster of the period is deleted for good.'), confirmLabel: tx('Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try {
      await deleteRoster((tenant?.id as string), roster)
      await load()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'roster_delete' })
    }
  }
  // The manager decides a request; an approved one goes on the sheet and the roster is saved.
  async function decide(request: RosterRequest, status: string) {
    try {
      await setRosterRequestStatus((tenant?.id as string), request.id, status, user?.id)
      let next: Roster = loaded
      if (status === 'approved') {
        const dates = datesBetween(request.from, request.to, days)
        if (request.kind === 'swap') {
          const date = request.from
          const a = loaded.assignments[request.employeeId]?.[date] || ''
          const b = loaded.assignments[request.swapEmployeeId]?.[date] || ''
          next = withCodes(withCodes(loaded, request.employeeId, { [date]: b }), request.swapEmployeeId, { [date]: a })
        } else if (dates.length) {
          next = withCodes(loaded, request.employeeId, Object.fromEntries(dates.map(date => [date, request.kind === 'wish' ? 'wish' : REQUEST_CODE[request.kind]])))
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
      const created = await createRosterRequest((tenant?.id as string), { departmentId: (department as RosterDepartment).id, employeeId: me.employeeId, ...ask, to: ask.kind === 'swap' ? ask.from : ask.to || ask.from })
      setRequests(list => [created, ...list])
      setAsk({ kind: 'leave', from: '', to: '', swapEmployeeId: '', swapDate: '', note: '' })
      notify(tx('Το αίτημα στάλθηκε στον προϊστάμενο.', 'The request was sent to the head of the department.'), 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_request_create' })
    }
  }
  async function withdraw(request: RosterRequest) {
    try {
      await setRosterRequestStatus((tenant?.id as string), request.id, 'cancelled', user?.id)
      setRequests(list => list.map(r => (r.id === request.id ? { ...r, status: 'cancelled' } : r)))
    } catch (error) {
      notifyError(error, 'save', { operation: 'roster_request_cancel' })
    }
  }

  const active = (roster?.members || []).filter(m => m.active !== false)
  const inactive = (roster?.members || []).filter(m => m.active === false)
  const nameOf = (id: string) => roster?.members.find(m => m.employeeId === id)?.name || '—'
  const codeAt = (id: string, date: string) => loaded.assignments[id]?.[date] || ''
  const countOf = (id: string, test: (code: string) => boolean) => days.filter(d => test(codeAt(id, d.date))).length
  const usesI = Boolean(roster && (Number(roster.demand?.weekday?.I) || Number(roster.demand?.weekend?.I) || Object.values((roster.demand?.overrides || {}) as Record<string, ShiftNeed>).some(o => Number(o.I)) || Object.values(roster.assignments || {}).some(row => Object.values(row || {}).includes('I'))))
  const shown = usesI ? SHIFTS : ['M', 'A', 'N']
  // The department's other shifts (owner, 9/11/2026): stored as kind:code («M:1»), shown by their own code.
  const others = customShifts(roster?.demand)
  const shortOf = (code: string) => (!code ? '' : String(code).includes(':') ? String(code).split(':')[1] : CODES[code]?.short || code)
  const labelOf = (code: string) => (String(code || '').includes(':') ? `${shortOf(code)} · ${others.find(o => o.code === code)?.label || ''} (${CODES[kindOf(code)]?.name || ''})` : CODES[code]?.label || '')
  const cellClass = (code: string) => (isLeave(code) ? 'leave' : kindOf(code) || 'none')
  const fmtDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '')
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const hasShifts = Boolean(roster && Object.values(roster.assignments || {}).some(row => Object.values(row || {}).some(isShift)))
  const historyDays = history.dates.slice(-3).map(date => periodDays(date, date)[0])
  const published = roster?.status === 'published'
  const visible = !staffMode || published
  const pending = requests.filter(r => r.status === 'pending')
  const myRequests = staffMode && me ? requests.filter(r => r.employeeId === me.employeeId || r.swapEmployeeId === me.employeeId) : []
  const limitTag = (m: RosterMember) =>
    [
      Array.isArray(m.allowed) && m.allowed.length && m.allowed.length < SHIFTS.length ? `${tx('μόνο', 'only')} ${m.allowed.map(c => CODES[c].short).join('/')}` : '',
      isExtra(m) ? tx('υπεράριθμος', 'extra') : '',
      m.noWeekends ? tx('χωρίς Σ/Κ', 'no weekends') : '',
      m.maxNights !== undefined && m.maxNights !== null && m.maxNights !== '' ? `${tx('έως', 'max')} ${m.maxNights} ${CODES.N.short}` : '',
      Number(m.percent) > 0 && Number(m.percent) < 100 ? `${m.percent}%` : '',
    ].filter(Boolean).join(' · ')
  const toggle = (name: string) => setPanel(p => (p === name ? '' : name))

  // The roster as the hospital prints it (owner, 9/11/2026): one A4 landscape sheet, and the same as Excel.
  const exportInput = () => ({
    en,
    department,
    period,
    status: roster?.status,
    days,
    members: active.map(m => ({ employeeId: m.employeeId, name: m.name, head: Boolean(m.isHead) })),
    codeAt,
    shortOf,
    kinds: shown,
    kindLabel: (kind: string) => CODES[kind].name as string,
    need: (day: RosterDay, kind: string) => demandFor(loaded.demand, day)[kind] || 0,
    targets,
    hours: HOURS,
    legend: [
      ...shown.map(c => [CODES[c].short, CODES[c].label, { A: 'a', N: 'n', I: 'i' }[c] || '']),
      ...others.map(o => [shortOf(o.code), o.label, ({ A: 'a', N: 'n', I: 'i' } as Record<string, string>)[kindOf(o.code)] || '']),
      [CODES.R.short, CODES.R.label, 'r'],
      [CODES.L.short, tx('Άδεια / αργία', 'Leave / holiday'), 'lv'],
    ],
  })
  const printRoster = (pdf: boolean) => {
    if (!printReport(rosterDocument(exportInput()), { pdf })) notify(tx('Ο φυλλομετρητής μπλόκαρε το νέο παράθυρο.', 'The browser blocked the new window.'), 'warning')
  }
  function exportExcel() {
    downloadXlsx(`Programma_${(department?.name || '').replace(/\s+/g, '_')}_${period.start}.xlsx`, [rosterSheet(exportInput())])
  }

  // What the parts of the page (RosterSheet, RosterPanels) read.
  const view: RosterView = { tx, canEdit, roster: loaded, codeStyle, CODES, REQUEST_KINDS, REQUEST_STATUS, RULE_TEXT, RULE_LABELS, days, history, dirty, saving, cell, setCell, need, setNeed, limits, setLimits, setPanel, ask, setAsk, dragId, setDragId, newShift, setNewShift, dropId, setDropId, rules, violations, targets, me, update, setMember, setDemand, setRule, addOther, setOther, removeOther, setDayNeed, setCode, dropOn, save, sendRequest, withdraw, active, inactive, nameOf, codeAt, countOf, shown, others, shortOf, labelOf, cellClass, fmtDay, weekdays, hasShifts, historyDays, myRequests, limitTag }
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
          {hasShifts && visible && <ExportMenu onPrint={() => printRoster(false)} onPdf={() => printRoster(true)} onExcel={exportExcel} />}
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
            {overseer && (
              <button type="button" className={`roster-tool${panel === 'requests' ? ' is-on' : ''}`} aria-pressed={panel === 'requests'} onClick={() => toggle('requests')}>
                <Inbox size={15} aria-hidden="true" />
                {tx('Αιτήματα', 'Requests')}
                {pending.length > 0 && <span className="roster-count">{pending.length}</span>}
              </button>
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

      {roster && (canEdit || overseer) && panel === 'requests' && (
        <section className="roster-panel roster-requests" aria-label={tx('Αιτήματα', 'Requests')}>
          {requests.length === 0 && <p className="roster-muted">{tx('Δεν υπάρχουν αιτήματα από το τμήμα.', 'No requests from the department.')}</p>}
          {[...pending, ...requests.filter(r => r.status !== 'pending').slice(0, 10)].map(r => (
            <div key={r.id} className="roster-request">
              <strong>{nameOf(r.employeeId)}</strong>
              <span>{REQUEST_KINDS[r.kind]}</span>
              <span>{r.kind === 'swap' ? `${fmtDay(r.from)} ${tx('με', 'with')} ${nameOf(r.swapEmployeeId)}` : r.to && r.to !== r.from ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : fmtDay(r.from)}</span>
              {r.note && <small>«{r.note}»</small>}
              {r.status === 'pending' && canEdit ? (
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
        <RosterMyRequests view={view} />
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
        <RosterRulesDialog view={view} />
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
        <RosterSheet view={view} />
      )}

      <RosterPopovers view={view} />
    </Page>
  )
}
