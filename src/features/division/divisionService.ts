// «Αρχική» of the Division Director: the departments of a division in one read (division_overview,
// the only call to the database for this screen). The browser-only sample hospital and the help
// preview show sample figures; the empty preview (?helpEmpty=1) a division without departments.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { isEmptyPreview } from '../../core/preview/emptyPreview'
import { hospitalDate, hospitalToday } from '../../core/dates/hospitalDate'
import { SAMPLE_DEFAULT_DIVISION, SAMPLE_DIVISION_DEPARTMENTS } from '../../core/tenant/sampleDepartments'
import { loadDivisionCandidates, loadDivisions } from '../interviews/interviewsService'

const isSample = () => isDemoDataEnvironment() || isOwnerPreview()
// division_overview is not in database.types yet: a client without the database types.
const untyped = () => supabase as unknown as SupabaseClient
const must = ({ data, error }: { data: unknown, error: unknown }) => { if (error) throw error; return data }

// The numbers of a department row; the percentages are 0–100 or null (no data: «—»).
export const COUNT_KEYS = ['staff', 'staffOnLeave', 'staffNew30', 'uncoveredNights', 'pendingRequests', 'pendingRequestsOver3Days', 'trainingExpiring30', 'falls30', 'pressureUlcers30', 'incidentsOpen'] as const
export const PERCENT_KEYS = ['trainingPct', 'fluPct', 'handHygienePct'] as const

// A department row of division_overview (the keys above, its id, name and next month's roster state).
export type DivisionDepartment = { id: string, name: string, rosterNextMonth?: string | null } & Partial<Record<typeof COUNT_KEYS[number] | typeof PERCENT_KEYS[number], number | null>>
// A division: its name and the professional categories it covers.
export type Division = { id: string, name: string, categories?: string[] }
export type DivisionTotals = Record<string, number | null>
// The figures the cards show: a division's totals, or one department's own numbers.
export type DivisionFigures = Partial<Record<typeof COUNT_KEYS[number] | typeof PERCENT_KEYS[number] | 'rosterPublished', number | null>>
// The Division Director's screen: the divisions to pick from, the division, its departments and totals.
export interface DivisionOverview { divisions: Array<{ id: string, name: string }>, division: Division | null, nextMonth: string, departments: DivisionDepartment[], totals: DivisionTotals }

// The month after today's (Europe/Athens): the roster the departments prepare now.
export function nextMonthOf(today = hospitalToday()) {
  const [year, month] = today.split('-').map(Number)
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

// The division's totals: counts added up, percentages weighted by each department's staff.
export function totalsOf(departments: DivisionDepartment[] = []): DivisionTotals {
  const totals: DivisionTotals = Object.fromEntries(COUNT_KEYS.map(key => [key, departments.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)]))
  for (const key of PERCENT_KEYS) {
    const known = departments.filter(row => row[key] != null && Number.isFinite(Number(row[key])))
    const weight = known.reduce((sum, row) => sum + (Number(row.staff) || 1), 0)
    totals[key] = known.length ? Math.round(known.reduce((sum, row) => sum + Number(row[key]) * (Number(row.staff) || 1), 0) / weight) : null
  }
  totals.rosterPublished = departments.filter(row => row.rosterNextMonth === 'published').length
  return totals
}

// [name, staff, on leave, new 30d, roster, uncovered nights, requests, waiting > 3 days, training %, expiring 30d, flu %, hand hygiene %, falls, pressure ulcers, open incidents]
type SampleRow = [string, number, number, number, string, number, number, number, number, number, number, number | null, number, number, number]
const SAMPLE_ROWS: Record<string, SampleRow[]> = {
  'demo-div-1': [
    ['ΜΕΘ', 38, 3, 2, 'published', 0, 2, 0, 94, 2, 71, 88, 0, 2, 1],
    ['Παθολογική', 42, 4, 1, 'draft', 3, 5, 2, 86, 4, 58, 79, 3, 1, 2],
    ['Χειρουργική', 36, 2, 1, 'published', 0, 1, 0, 91, 1, 64, 84, 1, 0, 0],
    ['Καρδιολογική', 28, 1, 0, 'draft', 1, 3, 1, 88, 3, 62, 81, 1, 1, 1],
    ['Ορθοπαιδική', 24, 2, 0, 'missing', 0, 0, 0, 79, 5, 49, 76, 2, 0, 1],
    ['Παιδιατρική', 22, 1, 1, 'published', 0, 2, 0, 96, 0, 77, 91, 0, 0, 0],
    ['ΜΕΝΝ', 19, 1, 0, 'published', 0, 0, 0, 98, 1, 82, 93, 0, 0, 0],
    ['Νεφρολογική', 17, 0, 1, 'missing', 0, 1, 1, 83, 2, 55, null, 0, 0, 0],
  ],
  'demo-div-2': [
    ['Κουζίνα', 21, 2, 1, 'published', 0, 1, 0, 90, 1, 44, null, 0, 0, 0],
    ['Αποστείρωση', 9, 0, 0, 'draft', 0, 1, 0, 92, 0, 61, 87, 0, 0, 0],
    ['Τεχνική Υπηρεσία', 14, 1, 0, 'missing', 0, 0, 0, 74, 3, 38, null, 0, 0, 1],
  ],
}
const SAMPLE_DIVISIONS: Array<{ id: string, name: string, categories: string[] }> = [
  { id: 'demo-div-1', name: 'Νοσηλευτική Υπηρεσία', categories: ['nursing'] },
  { id: 'demo-div-2', name: 'Διεύθυνση Λειτουργιών', categories: ['technical', 'support', 'administrative'] },
]
const sampleRow = ([name, staff, staffOnLeave, staffNew30, rosterNextMonth, uncoveredNights, pendingRequests, pendingRequestsOver3Days, trainingPct, trainingExpiring30, fluPct, handHygienePct, falls30, pressureUlcers30, incidentsOpen]: SampleRow): DivisionDepartment =>
  ({ id: name, name, staff, staffOnLeave, staffNew30, rosterNextMonth, uncoveredNights, pendingRequests, pendingRequestsOver3Days, trainingPct, trainingExpiring30, fluPct, handHygienePct, falls30, pressureUlcers30, incidentsOpen })

function sampleOverview(divisionId: string | null): DivisionOverview {
  const division = (SAMPLE_DIVISIONS.find(item => item.id === divisionId) || SAMPLE_DIVISIONS.find(item => item.id === SAMPLE_DEFAULT_DIVISION)) as typeof SAMPLE_DIVISIONS[number]
  const empty = isEmptyPreview()
  const departments = empty ? [] : SAMPLE_ROWS[division.id].map(sampleRow)
  return { divisions: SAMPLE_DIVISIONS.map(({ id, name }) => ({ id, name })), division: empty ? { ...division, categories: [] } : division, nextMonth: nextMonthOf(), departments, totals: totalsOf(departments) }
}

// The division's figures: { divisions, division, nextMonth, departments, totals }. Without a division id
// the database answers for the director's first division.
export async function loadDivisionOverview(organizationId: string | null | undefined, divisionId: string | null = null): Promise<DivisionOverview> {
  if (isSample()) return sampleOverview(divisionId)
  if (!organizationId) return { divisions: [], division: null, nextMonth: nextMonthOf(), departments: [], totals: totalsOf([]) }
  const data = (must(await untyped().rpc('division_overview', { p_organization_id: organizationId, p_division_id: divisionId || null })) || {}) as Partial<DivisionOverview>
  const departments = Array.isArray(data.departments) ? data.departments : []
  return { divisions: Array.isArray(data.divisions) ? data.divisions : [], division: data.division || null, nextMonth: data.nextMonth || nextMonthOf(), departments, totals: data.totals || totalsOf(departments) }
}

// The hospital's divisions with the departments each covers, for «Προβολή ως ρόλος»: in a hospital
// the departments' ids (hr_division_departments), in the sample hospital their names.
export async function loadDivisionChoices(organizationId: string | null | undefined): Promise<Array<{ id: string, name: string, departmentIds: string[] }>> {
  const { divisions } = await loadDivisions(organizationId)
  return (divisions || []).map(item => ({ id: item.id, name: item.name, departmentIds: isSample() ? [...(SAMPLE_DIVISION_DEPARTMENTS[item.id] || [])] : item.departments || [] }))
}

// «Επόμενες συνεντεύξεις»: the scheduled interviews of the division's candidates, the nearest first.
// An interview of the list (the candidates come from the Interviews module).
export type DivisionInterview = { id: string, candidateId: string, name: string, position: string, scheduledAt: string }
export async function loadDivisionInterviews(organizationId: string | null | undefined, categories: string[] = []): Promise<DivisionInterview[]> {
  if (isEmptyPreview()) return []
  const candidates = await loadDivisionCandidates(organizationId)
  const today = hospitalToday()
  return (candidates || [])
    .filter(candidate => !categories.length || categories.includes(candidate.professionalCategory))
    .flatMap(candidate => (candidate.interviews || []).filter((item: { status: string, scheduledAt?: string | null }) => item.status === 'scheduled' && item.scheduledAt && hospitalDate(item.scheduledAt) >= today).map((item: { id: string, scheduledAt: string }) => ({ id: item.id, candidateId: candidate.id, name: candidate.fullName, position: candidate.requestedPosition, scheduledAt: item.scheduledAt })))
    .sort((a: DivisionInterview, b: DivisionInterview) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
}
