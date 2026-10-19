import { ISHIKAWA_CATEGORIES, WHY_COUNT, analysisProgress, normalizeAnalysis } from './rootCauseAnalysis'

// The rows a CAPA and an audit keep in tables of their own
// (20261116100000_quality_relational.sql), and the shapes the screens use:
// a CAPA's steps, root cause analysis and progress notes, an audit's checklist.
// Pure functions; qualityService reads and writes the rows.

export const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
export function newRowId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
  hex[12] = '4'
  hex[16] = '89ab'[Math.floor(Math.random() * 4)]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}
// A row keeps its id once it has one from the database; a new one gets one here.
export const rowId = value => (isUuid(value) ? value : newRowId())
const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const byPosition = (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)
const single = value => (Array.isArray(value) ? value[0] || null : value || null)

// --- What to write ---------------------------------------------------------------------

// Two stored values are the same: dates and times by their instant, numbers by
// their value (numeric comes back as "1.00"), arrays by their items.
function same(a, b) {
  const left = a ?? null, right = b ?? null
  if (left === right) return true
  if (left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) return JSON.stringify(left) === JSON.stringify(right)
  if (typeof left === 'boolean' || typeof right === 'boolean') return false
  const leftNumber = Number(left), rightNumber = Number(right)
  if (String(left).trim() !== '' && String(right).trim() !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber
  if (/T\d{2}:/.test(String(left)) && /T\d{2}:/.test(String(right))) return Date.parse(left) === Date.parse(right)
  return String(left) === String(right)
}

// From the stored rows to the wanted ones: the rows to write (new, or with a
// field changed) and the ids to remove.
export function diffChildRows(existing = [], wanted = [], fields = []) {
  const stored = new Map(existing.map(row => [row.id, row]))
  const kept = new Set(wanted.map(row => row.id))
  return {
    upsert: wanted.filter(row => { const old = stored.get(row.id); return !old || fields.some(field => !same(old[field], row[field])) }),
    remove: existing.filter(row => !kept.has(row.id)).map(row => row.id),
  }
}

// --- CAPA steps --------------------------------------------------------------------------

export const SUB_ACTION_FIELDS = ['position', 'title', 'owner_label', 'due_date', 'done', 'done_at', 'done_by_label']

export const subActionFromRow = row => ({ id: row.id, title: row.title || '', owner: row.owner_label || '', dueDate: row.due_date || '', done: Boolean(row.done), doneAt: row.done_at || null, doneBy: row.done_by_label || '' })
export const subActionsFromRows = rows => [...(rows || [])].sort(byPosition).map(subActionFromRow)

// A step without a title is not kept; one not done keeps no completion.
export function subActionRows(steps = []) {
  return steps.filter(step => String(step?.title || '').trim()).map((step, index) => {
    const done = Boolean(step.done)
    return { id: rowId(step.id), position: index + 1, title: String(step.title).trim(), owner_label: text(step.owner), due_date: step.dueDate || null, done, done_at: done ? step.doneAt || new Date().toISOString() : null, done_by_label: done ? text(step.doneBy) : null }
  })
}

// --- CAPA root cause analysis ---------------------------------------------------------------

export const ROOT_CAUSE_SELECT = 'root_cause:quality_capa_root_cause_analyses(*,whys:quality_capa_root_cause_whys(*),factors:quality_capa_root_cause_factors(*))'

// The analysis as the CAPA tab shows it, from its row with the whys and causes; null without one.
export function analysisFromRow(value) {
  const row = single(value)
  if (!row) return null
  const whys = Array(WHY_COUNT).fill('')
  for (const why of row.whys || []) if (why.position >= 1 && why.position <= WHY_COUNT) whys[why.position - 1] = why.answer || ''
  const causes = Object.fromEntries(ISHIKAWA_CATEGORIES.map(([key]) => [key, (row.factors || []).filter(item => item.category === key).sort(byPosition).map(item => item.description)]))
  return { problem: row.problem_statement || '', whys, causes, rootCause: row.root_cause || '', updatedAt: row.updated_at || '', updatedBy: row.updated_by_label || '' }
}

// What the tables hold for an analysis: its row, its whys (by position) and its
// causes (by category and position). Nothing for an analysis with nothing written.
export function analysisRows(value) {
  const analysis = normalizeAnalysis(value)
  if (!analysisProgress(analysis).started) return null
  return {
    analysis: { problem_statement: text(analysis.problem), root_cause: text(analysis.rootCause), updated_by_label: text(analysis.updatedBy) },
    whys: analysis.whys.map((answer, index) => ({ position: index + 1, answer: String(answer || '').trim() })).filter(row => row.answer),
    factors: ISHIKAWA_CATEGORIES.flatMap(([key]) => analysis.causes[key].map(item => String(item || '').trim()).filter(Boolean).map((description, index) => ({ category: key, position: index + 1, description }))),
  }
}

// Whether two analyses say the same (the time and author of the last change aside).
export function sameAnalysis(a, b) {
  const content = value => { const rows = analysisRows(value); return rows ? JSON.stringify({ ...rows, analysis: { ...rows.analysis, updated_by_label: null } }) : null }
  return content(a) === content(b)
}

// --- CAPA progress ---------------------------------------------------------------------------

export const progressFromRow = row => ({ id: row.id, date: row.entry_date || '', note: row.note || '', author: row.author_label || '', createdAt: row.created_at || null })
export const progressFromRows = rows => [...(rows || [])].map(progressFromRow).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
export function progressRow(entry = {}) {
  const note = String(entry.note || '').trim()
  if (!note) return null
  return { id: rowId(entry.id), entry_date: entry.date || new Date().toISOString().slice(0, 10), note, author_label: text(entry.author) }
}

// --- Audit checklist ---------------------------------------------------------------------------

export const CHECKLIST_SELECT = 'checklist:quality_audit_checklist_items(*,finding:quality_findings!quality_audit_checklist_items_finding_id_organization_id_fkey(code))'
export const CHECKLIST_FIELDS = ['position', 'item', 'item_en', 'required', 'answer', 'result', 'note', 'finding_id', 'template_question_id', 'chapter_ref', 'chapter_title', 'clause_ref', 'guidance', 'evidence_required', 'evidence', 'weight', 'critical', 'finding_class', 'ad_hoc']
const ANSWERS = ['yes', 'partial', 'no', 'na']
const CLASSES = ['major', 'minor', 'observation', 'opportunity']

// A checklist row as the audit shows it; an answer that became a finding names its code.
export function checklistFromRows(rows) {
  return [...(rows || [])].sort(byPosition).map(row => {
    const findingId = single(row.finding)?.code || ''
    return {
      id: row.id, item: row.item || '', itemEn: row.item_en || row.item || '', required: row.required !== false, answer: row.result || row.answer || '', note: row.note || '',
      templateQuestionId: row.template_question_id || null, chapterRef: row.chapter_ref || '', chapterTitle: row.chapter_title || '', clauseRef: row.clause_ref || '',
      guidance: row.guidance || '', evidenceRequired: row.evidence_required || '', evidence: row.evidence || '', weight: Number(row.weight) || 1, critical: Boolean(row.critical),
      findingClass: row.finding_class || '', adHoc: Boolean(row.ad_hoc),
      ...(findingId ? { findingId } : {}),
    }
  })
}

// The checklist's rows; `findingIds` turns a finding code into the finding's id.
export function checklistRows(checklist = [], findingIds = new Map()) {
  return checklist.filter(row => String(row?.item || '').trim()).map((row, index) => ({
    id: rowId(row.id), position: index + 1, item: String(row.item).trim(), item_en: text(row.itemEn) && text(row.itemEn) !== String(row.item).trim() ? text(row.itemEn) : null,
    // result holds the four values; answer keeps yes / no / na for the earlier readers.
    required: row.required !== false, answer: ['yes', 'no', 'na'].includes(row.answer) ? row.answer : null, result: ANSWERS.includes(row.answer) ? row.answer : null, note: text(row.note),
    finding_id: row.findingId ? findingIds.get(row.findingId) || null : null,
    template_question_id: isUuid(row.templateQuestionId) ? row.templateQuestionId : null,
    chapter_ref: text(row.chapterRef), chapter_title: text(row.chapterTitle), clause_ref: text(row.clauseRef),
    guidance: text(row.guidance), evidence_required: text(row.evidenceRequired), evidence: text(row.evidence),
    weight: Number(row.weight) > 0 ? Number(row.weight) : 1, critical: Boolean(row.critical),
    finding_class: CLASSES.includes(row.findingClass) ? row.findingClass : null, ad_hoc: Boolean(row.adHoc),
  }))
}

// --- Audit team ----------------------------------------------------------------------------------

export const TEAM_FIELDS = ['position', 'role', 'employee_id', 'full_name', 'is_external', 'affiliation']
export const teamFromRows = rows => [...(rows || [])].sort(byPosition).map(row => ({ id: row.id, role: row.role || 'member', employeeId: row.employee_id || null, name: row.full_name || '', external: Boolean(row.is_external), affiliation: row.affiliation || '', departmentId: single(row.employee)?.department_id || null, department: single(row.employee)?.department_name || '' }))
export function teamRows(team = []) {
  return team.filter(member => String(member?.name || '').trim()).map((member, index) => ({
    id: rowId(member.id), position: index + 1, role: ['lead', 'member', 'expert', 'observer'].includes(member.role) ? member.role : 'member',
    employee_id: !member.external && isUuid(member.employeeId) ? member.employeeId : null, full_name: String(member.name).trim(), is_external: Boolean(member.external), affiliation: text(member.affiliation),
  }))
}
