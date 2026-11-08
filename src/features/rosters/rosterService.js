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

// The head first, always; then everyone else in the order the manager set (owner, 8/11/2026).
export const headsFirst = members => [...members.filter(m => m.isHead), ...members.filter(m => !m.isHead)]

// The department's people, as roster members (name, profession, active, head).
export async function loadDepartmentStaff(organizationId, department) {
  const employees = await loadEmployeesAsync(organizationId)
  const demo = isDemoDataEnvironment()
  return headsFirst(
    employees
      .filter(e => (demo ? e.department === department.name : e.departmentId === department.id))
      .filter(e => !e.employmentStatus || e.employmentStatus === 'active' || e.employmentStatus === 'leave')
      .map(e => ({ employeeId: e.dbId || e.id, name: `${e.lastName} ${e.firstName}`.trim(), profession: e.profession || '', isHead: isDepartmentHead(e.position), active: true, fixed: {}, wishes: {} })),
  )
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
})

export async function loadRoster(organizationId, departmentId, periodStart) {
  if (isDemoDataEnvironment()) return demoRead()[`${departmentId}|${periodStart}`] || null
  const { data, error } = await supabase
    .from('department_rosters')
    .select('id,department_id,period_start,period_end,demand,rules,members,assignments,status')
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
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  }
  const query = roster.id
    ? supabase.from('department_rosters').update(payload).eq('id', roster.id)
    : supabase.from('department_rosters').insert({ ...payload, created_by: userId || null })
  const { data, error } = await query.select('id,department_id,period_start,period_end,demand,rules,members,assignments,status').single()
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
