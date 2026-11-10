import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadDepartments } from '../management/departmentsService'
import { loadEmployeesAsync } from '../employees/employeeService'
import { addDays, seededRandom } from '../../core/data/demoSeed'
import { generateRoster, periodDays } from './rosterEngine'

// The department's monthly shift roster (owner, 8/11/2026). Production: public.department_rosters with RLS
// (supabase/migrations/20261231260100_department_rosters.sql). Demo: this browser only.
// The version changes when the Demo's own rosters change, so a browser that kept older ones gets the new ones.
const DEMO_KEY = 'lo-demo-rosters.v2'
const demoRead = () => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}')
  } catch {
    return {}
  }
}
const demoWrite = value => {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(value))
  } catch {
    // The demo keeps the roster in memory only when the browser refuses storage.
  }
}
const pad = n => String(n).padStart(2, '0')

// The hospital's roster period: from the 21st of a month to the 20th of the next (the IASO payroll cycle).
export function rosterPeriod(reference = new Date(), offset = 0) {
  let year = reference.getFullYear()
  let month = reference.getMonth() + (reference.getDate() >= 21 ? 0 : -1) + offset
  year += Math.floor(month / 12)
  month = ((month % 12) + 12) % 12
  const endYear = month === 11 ? year + 1 : year
  const endMonth = (month + 1) % 12
  return { start: `${year}-${pad(month + 1)}-21`, end: `${endYear}-${pad(endMonth + 1)}-20` }
}

export async function loadRosterDepartments(organizationId) {
  if (isDemoDataEnvironment()) {
    const employees = await loadEmployeesAsync(organizationId)
    const count = new Map()
    for (const e of employees) if (e.department) count.set(e.department, (count.get(e.department) || 0) + 1)
    // The demo opens on the department with the most people (a roster needs several).
    return [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b, 'el')).map(name => ({ id: name, name }))
  }
  return (await loadDepartments(organizationId)).filter(row => row.is_active !== false)
}

// The head of the department: their position says so (Προϊστάμενος/η, Head of Department).
export const isDepartmentHead = position => /προϊστάμεν|head of department/i.test(String(position || ''))

// A physician (staff category, or a professional category that says so): the medical service, not the ward rota.
export const isPhysician = e => e?.staffCategory === 'physician' || /ιατρ|physician|doctor/i.test(String(e?.profession || ''))
// Inactive or on leave in the register.
export const notAtWork = e => e?.employmentStatus === 'inactive' || e?.employmentStatus === 'leave'

// The head first, always; then everyone else in the order the manager set (owner, 8/11/2026).
export const headsFirst = members => [...members.filter(m => m.isHead), ...members.filter(m => !m.isHead)]

// The department's people, as roster members (name, profession, active, head).
export async function loadDepartmentStaff(organizationId, department) {
  const employees = await loadEmployeesAsync(organizationId)
  const demo = isDemoDataEnvironment()
  return headsFirst(
    employees
      .filter(e => (demo ? e.department === department.name : e.departmentId === department.id))
      // The medical service has its own rota: physicians are not in the department's shift roster (owner, 9/11/2026).
      .filter(e => !isPhysician(e))
      // Employees not at work in the register (inactive, on leave) come in out of the roster, below.
      .map(e => ({ employeeId: e.dbId || e.id, name: `${e.lastName} ${e.firstName}`.trim(), profession: e.profession || '', isHead: isDepartmentHead(e.position), userId: e.userId || null, inactiveInRegister: notAtWork(e), active: !notAtWork(e), fixed: {}, wishes: {} })),
  )
}

// The department's heads by their permissions (owner, 8/11/2026): the users with the department manager role in this
// department. Read through the same functions as Management › Users; whoever may not read them gets none (the page
// then knows the signed-in manager themselves, and the head can still be set by hand).
export async function loadDepartmentHeadUserIds(organizationId, departmentId) {
  if (isDemoDataEnvironment()) return []
  try {
    const [{ data: members, error }, { data: scopes, error: scopeError }] = await Promise.all([
      supabase.rpc('organization_users_list', { p_organization_id: organizationId }),
      supabase.rpc('organization_member_departments', { p_organization_id: organizationId }),
    ])
    if (error || scopeError) return []
    const inDepartment = new Set((scopes || []).filter(row => row.department_id === departmentId).map(row => row.membership_id))
    return (members || []).filter(row => row.role === 'department_manager' && row.status === 'active' && inDepartment.has(row.id)).map(row => row.user_id)
  } catch {
    return []
  }
}

// Who heads the department: set by hand on the roster first, else the permissions, else the job position.
export function markHeads(members, headUserIds = [], signedInManagerId = null) {
  const heads = new Set([...headUserIds, signedInManagerId].filter(Boolean))
  return headsFirst(members.map(m => ({ ...m, isHead: typeof m.headSet === 'boolean' ? m.headSet : Boolean((m.userId && heads.has(m.userId)) || m.isHead) })))
}

// The end of the previous roster (its last seven days per person): the new one starts from there.
export async function loadRosterHistory(organizationId, departmentId, previousStart) {
  const previous = await loadRoster(organizationId, departmentId, previousStart)
  if (!previous) return { history: {}, dates: [] }
  const dates = Object.values(previous.assignments || {}).flatMap(row => Object.keys(row || {}))
  const last = [...new Set(dates)].sort().slice(-7)
  const history = {}
  for (const [id, row] of Object.entries(previous.assignments || {})) history[id] = last.map(date => row?.[date] || '')
  return { history, dates: last }
}

const fromRow = row => ({
  id: row.id,
  departmentId: row.department_id,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  demand: row.demand,
  rules: row.rules || {},
  members: row.members || [],
  assignments: row.assignments || {},
  status: row.status || 'draft',
  publishedAt: row.published_at || null,
  changeLog: row.change_log || [],
})
const ROSTER_COLUMNS = 'id,department_id,period_start,period_end,demand,rules,members,assignments,status,published_at,change_log'

export async function loadRoster(organizationId, departmentId, periodStart) {
  if (isDemoDataEnvironment()) {
    const all = demoRead()
    const key = `${departmentId}|${periodStart}`
    // A roster saved (or deleted) in this browser wins over the Demo's own.
    return key in all ? all[key] || null : demoSeedRoster(organizationId, departmentId, periodStart)
  }
  const { data, error } = await supabase
    .from('department_rosters')
    .select(ROSTER_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

export async function saveRoster(organizationId, roster, userId) {
  if (isDemoDataEnvironment()) {
    const all = demoRead()
    const saved = { ...roster, id: roster.id || `demo-${roster.departmentId}-${roster.periodStart}` }
    all[`${roster.departmentId}|${roster.periodStart}`] = saved
    demoWrite(all)
    return saved
  }
  const payload = {
    organization_id: organizationId,
    department_id: roster.departmentId,
    period_start: roster.periodStart,
    period_end: roster.periodEnd,
    demand: roster.demand,
    rules: roster.rules || {},
    members: roster.members,
    assignments: roster.assignments,
    status: roster.status || 'draft',
    published_at: roster.publishedAt || null,
    change_log: roster.changeLog || [],
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  }
  const query = roster.id
    ? supabase.from('department_rosters').update(payload).eq('id', roster.id)
    : supabase.from('department_rosters').insert({ ...payload, created_by: userId || null })
  const { data, error } = await query.select(ROSTER_COLUMNS).single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteRoster(organizationId, roster) {
  if (isDemoDataEnvironment()) {
    const all = demoRead()
    // Kept as deleted, so the Demo's own roster does not come back.
    all[`${roster.departmentId}|${roster.periodStart}`] = null
    demoWrite(all)
    return
  }
  const { error } = await supabase.from('department_rosters').delete().eq('id', roster.id).eq('organization_id', organizationId)
  if (error) throw error
}

// The changes made to a published roster (owner, 8/11/2026): one line per cell that changed.
export function rosterChanges(before = {}, after = {}, userName = '', at = new Date().toISOString()) {
  const changes = []
  const ids = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  for (const id of ids) {
    const dates = new Set([...Object.keys(before?.[id] || {}), ...Object.keys(after?.[id] || {})])
    for (const date of [...dates].sort()) {
      const from = before?.[id]?.[date] || ''
      const to = after?.[id]?.[date] || ''
      if (from !== to) changes.push({ at, by: userName, employeeId: id, date, from, to })
    }
  }
  return changes
}

// Requests of the department's people (leave, a day off, a day they cannot work, a swap); the manager decides.
// Production: public.roster_requests (supabase/migrations/20261231260300_roster_requests.sql). Demo: this browser.
const REQUESTS_KEY = 'lo-demo-roster-requests.v2'
// null until this browser saves a request: the Demo's own requests stand until then.
const storedDemoRequests = () => {
  try {
    const value = localStorage.getItem(REQUESTS_KEY)
    return value == null ? null : JSON.parse(value)
  } catch {
    return null
  }
}
const demoRequests = async organizationId => storedDemoRequests() ?? (await demoSeedRequests(organizationId))
const writeDemoRequests = rows => {
  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(rows))
  } catch {
    // Kept in memory only when the browser refuses storage.
  }
}
const REQUEST_COLUMNS = 'id,department_id,employee_id,kind,date_from,date_to,swap_employee_id,swap_date,note,status,decided_at,created_at'
const requestFromRow = row => ({
  id: row.id,
  departmentId: row.department_id,
  employeeId: row.employee_id,
  kind: row.kind,
  from: row.date_from,
  to: row.date_to || row.date_from,
  swapEmployeeId: row.swap_employee_id || '',
  swapDate: row.swap_date || '',
  note: row.note || '',
  status: row.status,
  decidedAt: row.decided_at || null,
  createdAt: row.created_at,
})

export async function loadRosterRequests(organizationId, departmentId) {
  if (isDemoDataEnvironment()) return (await demoRequests(organizationId)).filter(row => row.departmentId === departmentId)
  const { data, error } = await supabase
    .from('roster_requests')
    .select(REQUEST_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('department_id', departmentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(requestFromRow)
}

export async function createRosterRequest(organizationId, request) {
  if (isDemoDataEnvironment()) {
    const row = { ...request, id: `demo-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() }
    writeDemoRequests([row, ...(await demoRequests(organizationId))])
    return row
  }
  const { data, error } = await supabase
    .from('roster_requests')
    .insert({
      organization_id: organizationId,
      department_id: request.departmentId,
      employee_id: request.employeeId,
      kind: request.kind,
      date_from: request.from,
      date_to: request.to || request.from,
      swap_employee_id: request.kind === 'swap' ? request.swapEmployeeId : null,
      swap_date: request.kind === 'swap' ? request.swapDate || request.from : null,
      note: request.note || null,
    })
    .select(REQUEST_COLUMNS)
    .single()
  if (error) throw error
  return requestFromRow(data)
}

// status: approved / rejected (the manager) or cancelled (the employee, while pending).
export async function setRosterRequestStatus(organizationId, id, status, userId) {
  if (isDemoDataEnvironment()) {
    writeDemoRequests((await demoRequests(organizationId)).map(row => (row.id === id ? { ...row, status, decidedAt: new Date().toISOString() } : row)))
    return
  }
  const patch = status === 'cancelled' ? { status } : { status, decided_by: userId || null, decided_at: new Date().toISOString() }
  const { error } = await supabase.from('roster_requests').update(patch).eq('id', id).eq('organization_id', organizationId)
  if (error) throw error
}

// The Demo's own rosters and requests (owner, 9/11/2026: every screen of the Demo has data). For every department
// with people on the ward rota: the previous period published (with one change logged after publishing) and the
// current one as a draft that starts where the previous ended; a few requests of the people, some decided. Made by
// the same engine as «Αυτόματη δημιουργία», with a fixed seed per department and period, so the same every time.
const DEMO_REQUEST_CODE = { leave: 'L', sick: 'S', unpaid: 'U', unavailable: 'R' }
const seedOf = text => 1 + Math.floor(seededRandom(text)() * 99999)
const demoRosterCache = new Map()

async function demoSeedRoster(organizationId, departmentId, periodStart) {
  // The screen opens on the next period (the one being prepared): its draft, and the running period published.
  const current = rosterPeriod(new Date(), 1), previous = rosterPeriod(new Date())
  if (periodStart !== current.start && periodStart !== previous.start) return null
  const key = `${organizationId}|${departmentId}|${current.start}`
  if (!demoRosterCache.has(key)) demoRosterCache.set(key, buildDemoRosters(organizationId, departmentId, previous, current).catch(() => null))
  const made = await demoRosterCache.get(key)
  return made ? structuredClone(made[periodStart === current.start ? 'current' : 'previous']) : null
}

async function buildDemoRosters(organizationId, departmentId, previous, current) {
  const members = headsFirst(await loadDepartmentStaff(organizationId, { id: departmentId, name: departmentId }))
  const regular = members.filter(m => !m.isHead && m.active)
  if (regular.length < 2) return null
  // One person per shift in a small ward, two from nine people on (a smaller ward cannot keep two on every shift);
  // with fewer people the ward rota keeps mornings and afternoons (three people) or mornings only (two).
  const need = regular.length >= 9 ? 2 : 1, afternoons = regular.length >= 3 ? need : 0, nights = regular.length >= 4 ? need : 0
  const demand = { weekday: { M: need, I: 0, A: afternoons, N: nights }, weekend: { M: need, I: 0, A: afternoons, N: nights }, overrides: {} }
  // The approved requests of the current period are already on the draft (leave, days they cannot work, wishes).
  const approved = (await demoRequests(organizationId)).filter(r => r.departmentId === departmentId && r.status === 'approved' && r.kind !== 'swap')
  const withRequests = (list, days) =>
    list.map(m => {
      const fixed = { ...(m.fixed || {}) }, wishes = { ...(m.wishes || {}) }
      for (const r of approved.filter(r => r.employeeId === m.employeeId)) {
        for (const day of days.filter(day => day.date >= r.from && day.date <= (r.to || r.from))) {
          if (r.kind === 'wish') wishes[day.date] = 'R'
          else fixed[day.date] = DEMO_REQUEST_CODE[r.kind]
        }
      }
      return { ...m, fixed, wishes }
    })
  const engine = list => list.map(m => ({ id: m.employeeId, name: m.name, active: m.active !== false, fixed: m.fixed || {}, wishes: m.wishes || {}, extra: Boolean(m.isHead) }))
  const make = (period, list, history) => generateRoster({ days: periodDays(period.start, period.end), employees: engine(list), demand, rules: {}, history, seed: seedOf(`roster|${departmentId}|${period.start}`), attempts: 1, iterations: 4000 }).assignments

  // The previous period: one person on three days of leave, published five days before it began.
  const previousDays = periodDays(previous.start, previous.end)
  const previousMembers = members.map(m => (m.employeeId === regular[regular.length - 1].employeeId ? { ...m, fixed: Object.fromEntries(previousDays.slice(9, 12).map(day => [day.date, 'L'])) } : m))
  const previousAssignments = make(previous, previousMembers, {})
  const changed = regular[0].employeeId, changedDate = previousDays[14].date
  const publishedAt = `${addDays(previous.start, -5)}T10:00:00.000Z`
  const previousRoster = {
    id: `demo-${departmentId}-${previous.start}`, departmentId, periodStart: previous.start, periodEnd: previous.end, demand, rules: {}, members: previousMembers, assignments: previousAssignments, status: 'published', publishedAt,
    changeLog: [{ at: `${changedDate}T08:30:00.000Z`, by: members[0].name, employeeId: changed, date: changedDate, from: previousAssignments[changed]?.[changedDate] === 'M' ? 'A' : 'M', to: previousAssignments[changed]?.[changedDate] || 'R' }],
  }
  // The current period starts from the last seven days of the previous one.
  const last = previousDays.slice(-7).map(day => day.date)
  const history = Object.fromEntries(Object.entries(previousAssignments).map(([id, row]) => [id, last.map(date => row?.[date] || '')]))
  const currentMembers = withRequests(members, periodDays(current.start, current.end))
  const currentRoster = { id: `demo-${departmentId}-${current.start}`, departmentId, periodStart: current.start, periodEnd: current.end, demand, rules: {}, members: currentMembers, assignments: make(current, currentMembers, history), status: 'draft', publishedAt: null, changeLog: [] }
  return { previous: previousRoster, current: currentRoster }
}

// A few requests in the three largest departments: leave approved, a wish and a swap waiting, one refused.
let demoRequestSeed = null
async function demoSeedRequests(organizationId) {
  const current = rosterPeriod(new Date(), 1)
  if (demoRequestSeed?.start === current.start) return structuredClone(await demoRequestSeed.rows)
  const build = async () => {
    const rows = []
    const departments = (await loadRosterDepartments(organizationId)).slice(0, 3)
    for (const [index, department] of departments.entries()) {
      const people = (await loadDepartmentStaff(organizationId, department)).filter(m => !m.isHead && m.active)
      if (people.length < 2) continue
      const at = (days, time = '09:00') => `${addDays(current.start, days)}T${time}:00.000Z`
      const row = (n, kind, from, to, status, extra = {}) => ({ id: `demo-request-${index + 1}-${n}`, departmentId: department.id, employeeId: people[n % people.length].employeeId, kind, from: addDays(current.start, from), to: addDays(current.start, to), swapEmployeeId: '', swapDate: '', note: '', status, decidedAt: status === 'pending' ? null : at(-6, '11:00'), createdAt: at(-9 + n), ...extra })
      rows.push(
        row(0, 'leave', 6 + index, 8 + index, 'approved', { note: 'Οικογενειακός λόγος.' }),
        row(1, 'wish', 12, 12, 'pending', { note: 'Γάμος στην οικογένεια.' }),
        row(2, 'swap', 17, 17, 'pending', { swapEmployeeId: people[3 % people.length].employeeId, swapDate: addDays(current.start, 18), note: 'Ανταλλαγή απογευματινής με πρωινή.' }),
        row(1, 'unavailable', 22, 22, 'approved', { id: `demo-request-${index + 1}-4` }),
        row(2, 'leave', -20, -18, 'rejected', { id: `demo-request-${index + 1}-5`, note: 'Ήδη δύο άτομα σε άδεια τις ίδιες ημέρες.' }),
      )
    }
    return rows
  }
  demoRequestSeed = { start: current.start, rows: build().catch(() => []) }
  return structuredClone(await demoRequestSeed.rows)
}
