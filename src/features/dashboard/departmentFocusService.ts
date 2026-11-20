// The bottom-middle card of «Το τμήμα μου» (owner, 20/11/2026: «να μη σκρολάρει κι αντί γι' αυτό να βλέπουν
// στοιχεία από τα μητρώα τους… όσα δεν έχουν, μόνο π.χ. συμβάντα»): the main indicators of the department's
// register for the current month; a department without one sees hand hygiene per month there, and its incidents
// of the last 30 days only when that chart is locked.
// Both are read as the register and Quality screens read them, under the same policies (register_can_read,
// quality_incident_org_read): what the manager may not read leaves the register card out.
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { useTenant } from '../../core/tenant/TenantContext'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { hospitalDate } from '../../core/dates/hospitalDate'
import { useRegisterAccess } from '../registers/registerAccess'
import { loadEntries, loadRegisters } from '../registers/registerService'
import { indicatorReport, periodOf, type Period } from '../registers/registerEngine'
import { loadQualityRecords } from '../quality/qualityService'
import { odipyItem } from '../quality/odipyCategories'
import type { Register } from '../registers/registerTypes'
import type { QualityRecord } from '../quality/qualityTypes'

// The indicators the card shows: a fixed number of lines, never a list that scrolls.
export const FOCUS_LINES = 4
export const INCIDENT_DAYS = 30
type ReportRow = ReturnType<typeof indicatorReport>[number]
// Worst first: past the limit, below target, on target, then the indicators without a target, each in the register's order.
const STATUS_RANK: Record<string, number> = { breach: 0, attention: 1, onTarget: 2, context: 3 }
export function registerFocusRows(register: Register, entries: Parameters<typeof indicatorReport>[1], period: Period, count = FOCUS_LINES): ReportRow[] {
  return indicatorReport(register, entries, period)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (STATUS_RANK[a.row.current.status || 'context'] ?? 3) - (STATUS_RANK[b.row.current.status || 'context'] ?? 3) || a.index - b.index)
    .slice(0, count)
    .map(item => item.row)
}

// The kinds of incident the card counts: items of the ΟΔΙΠΥ form (an earlier category reads as its item), the rest «other».
export const INCIDENT_KINDS = [['falls', 'odipy-fall'], ['pressureUlcers', 'odipy-ulcer'], ['medication', 'odipy-medication']] as const
export interface DepartmentIncidents { total: number, open: number, falls: number, pressureUlcers: number, medication: number, other: number }
export interface IncidentLine { category: string | null, status: string | null, reportKind?: string | null, at: string | null }
// The reports of the last 30 days (in Athens time), suggestions left out; open while reported or under review.
export function countDepartmentIncidents(rows: IncidentLine[], today = hospitalDate(), days = INCIDENT_DAYS): DepartmentIncidents {
  const counts: DepartmentIncidents = { total: 0, open: 0, falls: 0, pressureUlcers: 0, medication: 0, other: 0 }
  const first = hospitalDate(new Date(Date.parse(`${today}T12:00:00Z`) - (days - 1) * 86400000))
  for (const row of rows) {
    const day = row.at ? (row.at.length === 10 ? row.at : hospitalDate(row.at)) : ''
    if (!day || day < first || day > today || row.reportKind === 'suggestion') continue
    counts.total += 1
    if (['reported', 'underReview', 'under_review'].includes(String(row.status || 'reported'))) counts.open += 1
    const item = odipyItem(row.category || '')?.key
    const kind = INCIDENT_KINDS.find(([, key]) => key === item)?.[0]
    counts[kind || 'other'] += 1
  }
  return counts
}

const untyped = () => supabase as unknown as SupabaseClient
// The department's reports of the last 30 days. The Demo (and the help preview) count its sample records of the
// department by name; a hospital reads quality_incidents, which a department manager reads for their departments only.
export async function loadDepartmentIncidents(organizationId: string | null | undefined, departmentIds: string[] | null | undefined, department: string | null, today = hospitalDate()): Promise<DepartmentIncidents> {
  if (isDemoDataEnvironment() || isOwnerPreview()) {
    const rows = (await loadQualityRecords('incidents', organizationId)) as QualityRecord[]
    return countDepartmentIncidents(rows.filter(row => (!department || row.department === department) && row.lifecycleStatus !== 'voided').map(row => ({ category: row.category || null, status: row.status || null, reportKind: row.reportKind || null, at: row.date || row.createdAt || null })), today)
  }
  if (!supabase || !organizationId) throw new Error('DEPARTMENT_INCIDENTS_UNAVAILABLE')
  // A day more than the window: the day each report counts on is taken in Athens time below.
  const from = hospitalDate(new Date(Date.parse(`${today}T12:00:00Z`) - INCIDENT_DAYS * 86400000))
  let query = untyped().from('quality_incidents').select('category,status,report_kind,occurred_at,created_at').eq('organization_id', organizationId).neq('lifecycle_status', 'voided').or(`occurred_at.gte.${from},and(occurred_at.is.null,created_at.gte.${from})`)
  if (departmentIds?.length) query = query.in('department_id', departmentIds)
  const { data, error } = await query.limit(1000)
  if (error) throw error
  return countDepartmentIncidents((data || []).map((row: Record<string, string | null>) => ({ category: row.category, status: row.status, reportKind: row.report_kind, at: row.occurred_at || row.created_at })), today)
}

export type DepartmentFocus =
  | { kind: 'loading' }
  | { kind: 'register', register: Register, period: Period, rows: ReportRow[] }
  | { kind: 'incidents', incidents: DepartmentIncidents | null }
  | { kind: 'none' }

// The department's register (the first active one with indicators the manager is a member of and may read), else, when
// asked for (incidentsWanted: the quality module on and nothing else to show in their place), its incidents.
export function useDepartmentFocus(incidentsWanted: boolean): DepartmentFocus {
  const { tenant, isDemo, membership } = useTenant()
  const access = useRegisterAccess()
  const [focus, setFocus] = useState<DepartmentFocus>({ kind: 'loading' })
  const departmentIds: string[] = membership?.departmentIds || []
  const departmentKey = departmentIds.join('|')
  const department: string | null = isDemo ? membership?.previewDepartment || null : null
  useEffect(() => {
    let active = true
    const today = hospitalDate()
    ;(async () => {
      try {
        const register = (await loadRegisters(tenant?.id)).find(item => item.status === 'active' && (item.indicators?.length || 0) > 0 && access.isMember(item) && access.canSee(item))
        if (register) {
          const entries = await loadEntries(tenant?.id, register.id, { withIdentity: false, register })
          const period = periodOf('month', today)
          if (active) setFocus({ kind: 'register', register, period, rows: registerFocusRows(register, entries, period) })
          return
        }
      } catch { /* a register the manager may not read: the incidents instead */ }
      if (!incidentsWanted) { if (active) setFocus({ kind: 'none' }); return }
      const incidents = await loadDepartmentIncidents(tenant?.id, departmentKey ? departmentKey.split('|') : null, department, today).catch(() => null)
      if (active) setFocus({ kind: 'incidents', incidents })
    })()
    return () => { active = false }
  }, [tenant?.id, departmentKey, department, access, incidentsWanted])
  return focus
}
