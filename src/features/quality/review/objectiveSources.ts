import { supabase as configuredClient, type Cloud } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadCommittees } from '../../committees/committeeData'
import { loadDepartments } from '../../management/departmentsService'
import { demoLibrarySeed } from '../../management/managementData'
import { calculateCloudDefinition, collectCloudIndicatorMetrics, loadOperationalIndicatorDefinitions } from '../../indicators/indicatorCloudService'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { AnyRecord } from '../../../types/featureTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// Where the value of an objective comes from, and the hospital's other objectives: those of the committees'
// annual plans. An objective is measured by a department register's indicator, by an indicator of the platform
// (computed from the hospital's data) or by a value per month that its owner enters.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const todayIso = () => hospitalToday()

export const OBJECTIVE_LEVELS = ['hospital', 'department', 'committee']
export const objectiveLevel = (objective: AnyRecord) => objective.level || (objective.departmentId || objective.registerId ? 'department' : objective.committeeId ? 'committee' : 'hospital')
export const levelLabel = (level: number, en: boolean) => (en ? { hospital: 'Hospital', department: 'Department', committee: 'Committee' } : { hospital: 'Νοσοκομείο', department: 'Τμήμα', committee: 'Επιτροπή' })[level] || ''
// How an objective is measured.
export const objectiveSource = (objective: AnyRecord) => (objective.registerId ? 'register' : objective.platformIndicatorKey ? 'indicator' : 'monthly')

// The months of a year so far (all twelve for a past year, none for a future one).
export function monthsSoFar(year: number) {
  const now = new Date()
  return year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1
}
export const monthStart = (year: number, month: number) => `${year}-${pad(month)}-01`
const monthEnd = (year: number, month: number) => `${year}-${pad(month)}-${pad(lastDay(year, month))}`
const yearEnd = (year: number) => { const end = `${year}-12-31`, today = todayIso(); return end < today ? end : today }

// The mean of the months entered, the year's value of a monthly objective.
export function monthlyMean(values: AnyRecord[]) {
  const numbers = (values || []).map((row: AnyRecord) => Number(row.value)).filter(Number.isFinite)
  return numbers.length ? Math.round((numbers.reduce((sum: number, value: number) => sum + value, 0) / numbers.length) * 10) / 10 : null
}

export async function loadIndicatorDefinitions(organizationId: string | null | undefined) {
  return loadOperationalIndicatorDefinitions(organizationId).catch(() => [])
}

// The value of the platform's indicators for the year so far (one read of the hospital's data per year).
export async function platformValuesForYears(organizationId: string | null | undefined, definitions: AnyRecord[], years: number[]) {
  const byYear = new Map()
  for (const year of years) {
    if (year > new Date().getFullYear()) { byYear.set(year, new Map()); continue }
    const metrics = await collectCloudIndicatorMetrics(organizationId, { from: `${year}-01-01`, to: yearEnd(year) }).catch(() => null)
    byYear.set(year, new Map(metrics ? definitions.map((def: AnyRecord) => [def.id, calculateCloudDefinition(def, metrics).value]) : []))
  }
  return byYear
}

// The month-by-month value of the platform's indicators, for the year's file.
export async function platformMonthlyValues(organizationId: string | null | undefined, definitions: AnyRecord[], year: number, keys: string[]) {
  const wanted = definitions.filter((def: AnyRecord) => keys.includes(def.id))
  const months = []
  for (let month = 1; month <= monthsSoFar(year); month += 1) {
    const metrics = await collectCloudIndicatorMetrics(organizationId, { from: monthStart(year, month), to: monthEnd(year, month) }).catch(() => null)
    months.push({ month, values: new Map(metrics ? wanted.map((def: AnyRecord) => [def.id, calculateCloudDefinition(def, metrics).value]) : []) })
  }
  return months
}

// The hospital's departments and committees, for the names of the levels.
export async function loadLevelNames(organizationId: string | null | undefined) {
  if (isLocal()) {
    return {
      departments: demoLibrarySeed.departments.map(([name, nameEn]) => ({ id: name, name, nameEn })),
      committees: loadCommittees().map(item => ({ id: item.id, code: item.id, name: item.name, shortName: item.shortName || '' })),
    }
  }
  const [departments, committees] = await Promise.all([
    loadDepartments(organizationId).then(rows => (rows || []).map(row => ({ id: row.id, name: row.name, nameEn: row.name }))).catch(() => []),
    supabase.from('committees').select('id,code,name,short_name').eq('organization_id', organizationId as string).order('name').then(({ data }) => (data || []).map(row => ({ id: row.id, code: row.code, name: row.name, shortName: row.short_name || '' }))),
  ])
  return { departments, committees }
}

// The objectives of the committees' annual plans (committee_plan_items): their indicator, baseline and target are text.
export async function loadCommitteeTargets(organizationId: string | null | undefined) {
  if (isLocal()) {
    return loadCommittees().flatMap(committee => (committee.annualPlan || []).map((item: AnyRecord) => ({
      id: `${committee.id}-${item.id}`, committeeId: committee.id, committeeCode: committee.id, committeeName: committee.name, title: item.title, indicator: item.indicator || '', baseline: item.baseline || '', target: item.target || '', ownerLabel: item.owner || '', dueDate: item.dueDate || '', status: item.status || 'open', year: Number(String(item.dueDate || '').slice(0, 4)) || new Date().getFullYear(),
    })))
  }
  const { data, error } = await supabase.from('committee_plan_items').select('id,committee_id,title,indicator,baseline,target,owner_label,due_date,status,created_at,committee:committees(code,name)').eq('organization_id', organizationId as string).order('due_date', { ascending: true, nullsFirst: false })
  if (error) return []
  return ((data || []) as AnyRecord[]).map(row => ({
    id: row.id, committeeId: row.committee_id, committeeCode: row.committee?.code || '', committeeName: row.committee?.name || '', title: row.title, indicator: row.indicator || '', baseline: row.baseline || '', target: row.target || '', ownerLabel: row.owner_label || '', dueDate: row.due_date || '', status: row.status || 'open', year: Number(String(row.due_date || row.created_at || '').slice(0, 4)) || new Date().getFullYear(),
  }))
}
export const planStatusLabel = (status: string, en: boolean) => (en ? { open: 'Open', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' } : { open: 'Ανοιχτός', in_progress: 'Σε εξέλιξη', completed: 'Ολοκληρώθηκε', cancelled: 'Ακυρώθηκε' })[status] || status
