import { ISHIKAWA_CATEGORIES, WHY_COUNT, analysisProgress, normalizeAnalysis } from './rootCauseAnalysis'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { Tables } from '../../core/supabase/database.types'
import type { AuditChecklistItem, AuditChecklistRow, AuditTeamMember, AuditTeamRow, CapaProgressEntry, CapaProgressRow, CapaSubAction, CapaSubActionRow, ChildRow } from './qualityTypes'

// The stored root cause analysis of a CAPA with its whys and causes (ROOT_CAUSE_SELECT).
type RootCauseRow = Tables<'quality_capa_root_cause_analyses'> & { whys?: Tables<'quality_capa_root_cause_whys'>[] | null, factors?: Tables<'quality_capa_root_cause_factors'>[] | null }

// The rows a CAPA and an audit keep in tables of their own
// (20261116100000_quality_relational.sql), and the shapes the screens use:
// a CAPA's steps, root cause analysis and progress notes, an audit's checklist.
// Pure functions; qualityService reads and writes the rows.

export const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
export function newRowId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
  hex[12] = '4'
  hex[16] = '89ab'[Math.floor(Math.random() * 4)]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}
// A row keeps its id once it has one from the database; a new one gets one here.
export const rowId = (value: unknown): string => (isUuid(value) ? value as string : newRowId())
const text = (value: unknown) => { const kept = String(value ?? '').trim(); return kept || null }
const byPosition = (a: { position?: number | null }, b: { position?: number | null }) => (Number(a.position) || 0) - (Number(b.position) || 0)
const single = <T>(value: unknown): T | null => (Array.isArray(value) ? value[0] || null : (value as T) || null)

// --- What to write ---------------------------------------------------------------------

// Two stored values are the same: dates and times by their instant, numbers by
// their value (numeric comes back as "1.00"), arrays by their items.
function same(a: unknown, b: unknown) {
  const left = a ?? null, right = b ?? null
  if (left === right) return true
  if (left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) return JSON.stringify(left) === JSON.stringify(right)
  if (typeof left === 'boolean' || typeof right === 'boolean') return false
  const leftNumber = Number(left), rightNumber = Number(right)
  if (String(left).trim() !== '' && String(right).trim() !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber
  if (/T\d{2}:/.test(String(left)) && /T\d{2}:/.test(String(right))) return Date.parse(String(left)) === Date.parse(String(right))
  return String(left) === String(right)
}

// From the stored rows to the wanted ones: the rows to write (new, or with a
// field changed) and the ids to remove.
// The stored rows come from a select of a column list, which the client types loosely.
export function diffChildRows<T extends ChildRow>(existing: unknown[] = [], wanted: T[] = [], fields: string[] = []) {
  const stored = new Map((existing as ChildRow[]).map(row => [row.id, row]))
  const kept = new Set(wanted.map(row => row.id))
  return {
    upsert: wanted.filter(row => { const old = stored.get(row.id); return !old || fields.some(field => !same(old[field], row[field])) }),
    remove: (existing as ChildRow[]).filter(row => !kept.has(row.id)).map(row => row.id as string),
  }
}

// --- CAPA steps --------------------------------------------------------------------------

export const SUB_ACTION_FIELDS = ['position', 'title', 'owner_label', 'due_date', 'done', 'done_at', 'done_by_label']

export const subActionFromRow = (row: CapaSubActionRow): CapaSubAction => ({ id: row.id, title: row.title || '', owner: row.owner_label || '', dueDate: row.due_date || '', done: Boolean(row.done), doneAt: row.done_at || null, doneBy: row.done_by_label || '' })
export const subActionsFromRows = (rows: CapaSubActionRow[] | null | undefined) => [...(rows || [])].sort(byPosition).map(subActionFromRow)

// A step without a title is not kept; one not done keeps no completion.
export function subActionRows(steps: Partial<CapaSubAction>[] = []) {
  return steps.filter(step => String(step?.title || '').trim()).map((step, index) => {
    const done = Boolean(step.done)
    return { id: rowId(step.id), position: index + 1, title: String(step.title).trim(), owner_label: text(step.owner), due_date: step.dueDate || null, done, done_at: done ? step.doneAt || new Date().toISOString() : null, done_by_label: done ? text(step.doneBy) : null }
  })
}

// --- CAPA root cause analysis ---------------------------------------------------------------

export const ROOT_CAUSE_SELECT = 'root_cause:quality_capa_root_cause_analyses(*,whys:quality_capa_root_cause_whys(*),factors:quality_capa_root_cause_factors(*))'

// The analysis as the CAPA tab shows it, from its row with the whys and causes; null without one.
export function analysisFromRow(value: unknown) {
  const row = single<RootCauseRow>(value)
  if (!row) return null
  const whys = Array(WHY_COUNT).fill('')
  for (const why of row.whys || []) if (why.position >= 1 && why.position <= WHY_COUNT) whys[why.position - 1] = why.answer || ''
  const causes = Object.fromEntries(ISHIKAWA_CATEGORIES.map(([key]) => [key, (row.factors || []).filter((item: Tables<'quality_capa_root_cause_factors'>) => item.category === key).sort(byPosition).map((item: Tables<'quality_capa_root_cause_factors'>) => item.description)]))
  return { problem: row.problem_statement || '', whys, causes, rootCause: row.root_cause || '', updatedAt: row.updated_at || '', updatedBy: row.updated_by_label || '' }
}

// What the tables hold for an analysis: its row, its whys (by position) and its
// causes (by category and position). Nothing for an analysis with nothing written.
export function analysisRows(value: unknown) {
  const analysis = normalizeAnalysis(value)
  if (!analysisProgress(analysis).started) return null
  return {
    analysis: { problem_statement: text(analysis.problem), root_cause: text(analysis.rootCause), updated_by_label: text(analysis.updatedBy) },
    whys: analysis.whys.map((answer, index: number) => ({ position: index + 1, answer: String(answer || '').trim() })).filter((row: { answer: string }) => row.answer),
    factors: ISHIKAWA_CATEGORIES.flatMap(([key]) => analysis.causes[key].map((item: string) => String(item || '').trim()).filter(Boolean).map((description: string, index: number) => ({ category: key, position: index + 1, description }))),
  }
}

// Whether two analyses say the same (the time and author of the last change aside).
export function sameAnalysis(a: unknown, b: unknown) {
  const content = (value: unknown) => { const rows = analysisRows(value); return rows ? JSON.stringify({ ...rows, analysis: { ...rows.analysis, updated_by_label: null } }) : null }
  return content(a) === content(b)
}

// --- CAPA progress ---------------------------------------------------------------------------

export const progressFromRow = (row: CapaProgressRow): CapaProgressEntry => ({ id: row.id, date: row.entry_date || '', note: row.note || '', author: row.author_label || '', createdAt: row.created_at || null })
export const progressFromRows = (rows: CapaProgressRow[] | null | undefined) => [...(rows || [])].map(progressFromRow).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
export function progressRow(entry: Partial<CapaProgressEntry> = {}) {
  const note = String(entry.note || '').trim()
  if (!note) return null
  return { id: rowId(entry.id), entry_date: entry.date || hospitalToday(), note, author_label: text(entry.author) }
}

// --- Audit checklist ---------------------------------------------------------------------------

const STANDARDS = ['iso9001', 'iso15224', 'haccp', 'iso15189', 'temos', 'jci', 'other']
export const CHECKLIST_SELECT = 'checklist:quality_audit_checklist_items(*,finding:quality_findings!quality_audit_checklist_items_finding_id_organization_id_fkey(code))'
export const CHECKLIST_FIELDS = ['position', 'item', 'item_en', 'required', 'answer', 'result', 'note', 'finding_id', 'template_question_id', 'chapter_ref', 'chapter_title', 'clause_ref', 'guidance', 'evidence_required', 'evidence', 'weight', 'critical', 'finding_class', 'ad_hoc', 'standard']
const ANSWERS = ['yes', 'partial', 'no', 'na']
const CLASSES = ['major', 'minor', 'observation', 'opportunity']

// A checklist row as the audit shows it; an answer that became a finding names its code.
export function checklistFromRows(rows: AuditChecklistRow[] | null | undefined): AuditChecklistItem[] {
  return [...(rows || [])].sort(byPosition).map(row => {
    const findingId = single<{ code: string }>(row.finding)?.code || ''
    return {
      id: row.id, item: row.item || '', itemEn: row.item_en || row.item || '', required: row.required !== false, answer: row.result || row.answer || '', note: row.note || '',
      templateQuestionId: row.template_question_id || null, chapterRef: row.chapter_ref || '', chapterTitle: row.chapter_title || '', clauseRef: row.clause_ref || '',
      guidance: row.guidance || '', evidenceRequired: row.evidence_required || '', evidence: row.evidence || '', weight: Number(row.weight) || 1, critical: Boolean(row.critical),
      findingClass: row.finding_class || '', adHoc: Boolean(row.ad_hoc), standard: row.standard || '',
      ...(findingId ? { findingId } : {}),
    }
  })
}

// The checklist's rows; `findingIds` turns a finding code into the finding's id.
export function checklistRows(checklist: AuditChecklistItem[] = [], findingIds = new Map<string, string>()) {
  return checklist.filter(row => String(row?.item || '').trim()).map((row, index) => ({
    id: rowId(row.id), position: index + 1, item: String(row.item).trim(), item_en: text(row.itemEn) && text(row.itemEn) !== String(row.item).trim() ? text(row.itemEn) : null,
    // result holds the four values; answer keeps yes / no / na for the earlier readers.
    required: row.required !== false, answer: ['yes', 'no', 'na'].includes(row.answer as string) ? row.answer : null, result: ANSWERS.includes(row.answer as string) ? row.answer : null, note: text(row.note),
    finding_id: row.findingId ? findingIds.get(row.findingId) || null : null,
    template_question_id: isUuid(row.templateQuestionId) ? row.templateQuestionId : null,
    chapter_ref: text(row.chapterRef), chapter_title: text(row.chapterTitle), clause_ref: text(row.clauseRef),
    guidance: text(row.guidance), evidence_required: text(row.evidenceRequired), evidence: text(row.evidence),
    weight: Number(row.weight) > 0 ? Number(row.weight) : 1, critical: Boolean(row.critical),
    finding_class: CLASSES.includes(row.findingClass as string) ? row.findingClass : null, ad_hoc: Boolean(row.adHoc),
    standard: STANDARDS.includes(row.standard as string) ? row.standard : null,
  }))
}

// --- Audit team ----------------------------------------------------------------------------------

export const TEAM_FIELDS = ['position', 'role', 'employee_id', 'full_name', 'is_external', 'affiliation']
export const teamFromRows = (rows: AuditTeamRow[] | null | undefined): AuditTeamMember[] => [...(rows || [])].sort(byPosition).map(row => ({ id: row.id, role: row.role || 'member', employeeId: row.employee_id || null, name: row.full_name || '', external: Boolean(row.is_external), affiliation: row.affiliation || '', departmentId: single<EmployeeDepartment>(row.employee)?.department_id || null, department: single<EmployeeDepartment>(row.employee)?.department_name || '' }))
// The department of an audit team member who is an employee (TEAM_SELECT).
type EmployeeDepartment = { department_id: string | null, department_name: string | null }
export function teamRows(team: Partial<AuditTeamMember>[] = []) {
  return team.filter(member => String(member?.name || '').trim()).map((member, index) => ({
    id: rowId(member.id), position: index + 1, role: ['lead', 'member', 'expert', 'observer'].includes(member.role as string) ? member.role : 'member',
    employee_id: !member.external && isUuid(member.employeeId) ? member.employeeId : null, full_name: String(member.name).trim(), is_external: Boolean(member.external), affiliation: text(member.affiliation),
  }))
}
