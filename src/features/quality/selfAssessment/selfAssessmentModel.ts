import { auditScore, needsClass, questionsForAudit } from '../audits/auditModel'
import { hospitalToday } from '../../../core/dates/hospitalDate'

// One question of a self-assessment (a row of the audit questionnaire) with the department's answer.
// A type, not an interface, so that the checklist is stored as JSON as it is.
export type SelfRow = { id: string, item?: string, answer?: string, note?: string, evidence?: string, critical?: boolean, clauseRef?: string, chapterRef?: string, chapterTitle?: string, guidance?: string, evidenceRequired?: string, position?: number }
// The audit questionnaire a self-assessment is opened from: the type the audits take (auditModel).
export type SelfTemplate = NonNullable<Parameters<typeof questionsForAudit>[0]>
// A department's self-assessment (quality_self_assessments, or the Demo's copy in the browser).
export interface SelfAssessment {
  id: string
  organizationId: string | null | undefined
  templateId: string | null
  standard: string
  title: string
  departmentId: string
  departmentName: string
  status: string
  dueOn: string
  releasedAt: string
  submittedAt: string
  checklist: SelfRow[]
  totalCount: number
  answeredCount: number
  score: number | null
  updatedAt: string
}

// The self-assessment of a department against an audit questionnaire, in pure
// functions: the checklist it opens with, its progress and score (the audit scale)
// and the gaps the audit starts from. Nothing here reads or writes.

export const SELF_STATUSES = [
  { value: 'draft', label: ['Πρόχειρη', 'Draft'], tone: 'neutral' },
  { value: 'released', label: ['Σε εξέλιξη', 'In progress'], tone: 'info' },
  { value: 'submitted', label: ['Υποβλήθηκε', 'Submitted'], tone: 'success' },
  { value: 'closed', label: ['Έκλεισε', 'Closed'], tone: 'neutral' },
]
export const selfStatusLabel = (value: string | null | undefined, language = 'el') => { const item = SELF_STATUSES.find(entry => entry.value === value); return item ? item.label[language === 'en' ? 1 : 0] : value || '' }
export const selfStatusTone = (value: string | null | undefined) => SELF_STATUSES.find(entry => entry.value === value)?.tone || 'neutral'

// The rows of a self-assessment: the questionnaire's questions for the department's area.
export const selfChecklist = (template: SelfTemplate, departmentName = ''): SelfRow[] => questionsForAudit(template, { department: departmentName })

const ANSWERS = ['yes', 'partial', 'no', 'na']
// Answered rows, the share of all rows, and the compliance score of the answers given.
export function selfFigures(checklist: SelfRow[] = []) {
  const total = checklist.length
  const answered = checklist.filter(row => ANSWERS.includes(row.answer as string)).length
  const { overall } = auditScore(checklist)
  return { total, answered, pct: total ? Math.round((answered * 100) / total) : 0, score: overall.rate, yes: overall.yes, partial: overall.partial, no: overall.no, na: overall.na, criticalFailed: checklist.filter(row => row.critical && row.answer === 'no').length }
}

// What the department should fix before the audit: partial and nonconforming answers, critical ones first.
export const selfGaps = (checklist: SelfRow[] = []) => checklist.filter(needsClass).sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)) || (a.position || 0) - (b.position || 0))

// The chapters of the checklist in order, with the rows of each.
export function selfChapters(checklist: SelfRow[] = []) {
  const chapters = new Map<string, { ref: string, title: string, rows: SelfRow[] }>()
  for (const row of checklist) {
    const key = row.chapterRef || '—'
    if (!chapters.has(key)) chapters.set(key, { ref: row.chapterRef || '', title: row.chapterTitle || '', rows: [] })
    chapters.get(key)?.rows.push(row)
  }
  return [...chapters.values()]
}

export const isOverdue = (item: SelfAssessment, today = hospitalToday()) => Boolean(item.dueOn) && item.dueOn < today && item.status === 'released'

export function selfCounts(items: SelfAssessment[] = []) {
  return {
    total: items.length,
    inProgress: items.filter(item => item.status === 'released').length,
    submitted: items.filter(item => item.status === 'submitted').length,
    drafts: items.filter(item => item.status === 'draft').length,
    overdue: items.filter(item => isOverdue(item)).length,
  }
}

export function filterSelf(items: SelfAssessment[] = [], query = '') {
  const q = String(query || '').trim().toLowerCase()
  return q ? items.filter(item => `${item.title} ${item.departmentName}`.toLowerCase().includes(q)) : items
}

export const selfExport = (items: SelfAssessment[] = [], language = 'el') => {
  const en = language === 'en'
  return {
    name: en ? 'self-assessments' : 'aftoaxiologiseis',
    headers: en ? ['Title', 'Department', 'Status', 'Answered', 'Total', 'Score %', 'Due'] : ['Τίτλος', 'Τμήμα', 'Κατάσταση', 'Απαντήθηκαν', 'Σύνολο', 'Βαθμός %', 'Προθεσμία'],
    rows: items.map(item => [item.title, item.departmentName, selfStatusLabel(item.status, language), item.answeredCount, item.totalCount, item.score ?? '', item.dueOn || '']),
  }
}
