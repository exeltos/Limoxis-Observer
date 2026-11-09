import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadDepartments } from '../management/departmentsService'
import { loadEmployeesAsync } from '../employees/employeeService'

// The department's monthly shift roster (owner, 8/11/2026). Production: public.department_rosters with RLS
// (supabase/migrations/20261231260100_department_rosters.sql). Demo: this browser only.
const DEMO_KEY = 'lo-demo-rosters'
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
  if (isDemoDataEnvironment()) return demoRead()[`${departmentId}|${periodStart}`] || null
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
    delete all[`${roster.departmentId}|${roster.periodStart}`]
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
const REQUESTS_KEY = 'lo-demo-roster-requests'
const demoRequests = () => {
  try {
    return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]')
  } catch {
    return []
  }
}
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
  if (isDemoDataEnvironment()) return demoRequests().filter(row => row.departmentId === departmentId)
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
    writeDemoRequests([row, ...demoRequests()])
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
    writeDemoRequests(demoRequests().map(row => (row.id === id ? { ...row, status, decidedAt: new Date().toISOString() } : row)))
    return
  }
  const patch = status === 'cancelled' ? { status } : { status, decided_by: userId || null, decided_at: new Date().toISOString() }
  const { error } = await supabase.from('roster_requests').update(patch).eq('id', id).eq('organization_id', organizationId)
  if (error) throw error
}
