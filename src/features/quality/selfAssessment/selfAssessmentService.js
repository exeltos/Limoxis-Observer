import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { isEmptyPreview } from '../../../core/preview/emptyPreview'
import { seededRandom } from '../../../core/data/demoSeed'
import { selfChecklist, selfFigures } from './selfAssessmentModel'
import { hospitalDate } from '../../../core/dates/hospitalDate'

// The self-assessments of departments (20261214100000_quality_self_assessments.sql). The
// Quality team creates and releases them; a department answers through
// quality_self_assessment_save. The demo keeps them in the browser.

const LOCAL_KEY = 'quality_local_self_assessments'
const must = ({ data, error }) => { if (error) throw error; return data }
const localId = () => `sa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const local = () => loadSnapshot(LOCAL_KEY, []) || []

export const selfFromRow = row => ({
  id: row.id,
  organizationId: row.organization_id,
  templateId: row.template_id || null,
  standard: row.standard || '',
  title: row.title || '',
  departmentId: row.department_id,
  departmentName: row.department_name || '',
  status: row.status,
  dueOn: row.due_on || '',
  releasedAt: row.released_at || '',
  submittedAt: row.submitted_at || '',
  checklist: row.checklist || [],
  totalCount: row.total_count || 0,
  answeredCount: row.answered_count || 0,
  score: row.score ?? null,
  updatedAt: row.updated_at || '',
})

export async function loadSelfAssessments(organizationId) {
  if (isDemoDataEnvironment()) {
    const saved = loadSnapshot(LOCAL_KEY, null)
    if (Array.isArray(saved)) return saved
    // The first visit of the Demo starts from its own self-assessments (kept in the browser from then on).
    const seed = await demoSelfAssessments(organizationId)
    saveSnapshot(LOCAL_KEY, seed)
    return seed
  }
  if (!organizationId || !supabase) return []
  const rows = must(await supabase.from('quality_self_assessments').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(500)) || []
  return rows.map(selfFromRow)
}

// One self-assessment per department, each with the questionnaire's questions for its area.
export async function createSelfAssessments(organizationId, { template, departments, title, dueOn }) {
  const made = (departments || []).map(department => {
    const checklist = selfChecklist(template, department.name)
    const figures = selfFigures(checklist)
    return { id: localId(), organizationId, templateId: template.isSystem && String(template.id).startsWith('system-') ? null : template.id, standard: template.standard || '', title, departmentId: department.id, departmentName: department.name, status: 'draft', dueOn: dueOn || '', releasedAt: '', submittedAt: '', checklist, totalCount: figures.total, answeredCount: 0, score: null, updatedAt: new Date().toISOString() }
  }).filter(item => item.checklist.length)
  if (isDemoDataEnvironment()) { saveSnapshot(LOCAL_KEY, [...made, ...local()]); return made }
  if (!made.length) return []
  const rows = made.map(item => ({ organization_id: organizationId, template_id: item.templateId && /^[0-9a-f-]{36}$/i.test(item.templateId) ? item.templateId : null, standard: item.standard || null, title: item.title, department_id: item.departmentId, department_name: item.departmentName, due_on: item.dueOn || null, checklist: item.checklist, total_count: item.totalCount }))
  return (must(await supabase.from('quality_self_assessments').insert(rows).select('*')) || []).map(selfFromRow)
}

// draft → released (the department sees it) → submitted → closed; a released one may go back to draft.
export async function setSelfStatus(organizationId, item, status) {
  const now = new Date().toISOString()
  if (isDemoDataEnvironment()) { saveSnapshot(LOCAL_KEY, local().map(row => (row.id === item.id ? { ...row, status, releasedAt: status === 'released' ? now : row.releasedAt, updatedAt: now } : row))); return }
  must(await supabase.from('quality_self_assessments').update({ status, ...(status === 'released' ? { released_at: now } : {}) }).eq('id', item.id).eq('organization_id', organizationId).select('id'))
}

export async function removeSelfAssessment(organizationId, item) {
  if (isDemoDataEnvironment()) { saveSnapshot(LOCAL_KEY, local().filter(row => row.id !== item.id)); return }
  must(await supabase.from('quality_self_assessments').delete().eq('id', item.id).eq('organization_id', organizationId).select('id'))
}

// answers: [{id, answer, note, evidence}]. submit needs every row answered.
export async function saveSelfAnswers(organizationId, item, answers, { submit = false } = {}) {
  if (isDemoDataEnvironment()) {
    const byId = new Map(answers.map(entry => [entry.id, entry]))
    const checklist = item.checklist.map(row => (byId.has(row.id) ? { ...row, answer: byId.get(row.id).answer || '', note: byId.get(row.id).note || '', evidence: byId.get(row.id).evidence || '' } : row))
    const figures = selfFigures(checklist)
    if (submit && figures.answered < figures.total) throw new Error('SELF_ASSESSMENT_INCOMPLETE')
    const now = new Date().toISOString()
    const next = { ...item, checklist, answeredCount: figures.answered, totalCount: figures.total, score: figures.score, status: submit ? 'submitted' : item.status, submittedAt: submit ? now : item.submittedAt, updatedAt: now }
    saveSnapshot(LOCAL_KEY, local().map(row => (row.id === item.id ? next : row)))
    return next
  }
  return must(await supabase.rpc('quality_self_assessment_save', { p_id: item.id, p_answers: answers, p_submit: submit }))
}

// The Demo's self-assessments (owner, 9/11/2026: the whole of 2025 and 2026): the clinical departments answered the
// ward checklist in spring and autumn 2025 and in spring 2026 (submitted, then closed after the audit), and the
// second round of 2026 is under way (in progress, one not answered yet, one still a draft). Answers are seeded,
// so the scores are the same every time; they improve from round to round.
const DEMO_SELF_DEPARTMENTS = ['ΜΕΘ', 'Παθολογική', 'Χειρουργική', 'Καρδιολογική', 'Ορθοπαιδική', 'Νεογνολογική / ΜΕΝΝ']
const DEMO_SELF_NOTES = { partial: ['Λείπει η υπογραφή σε δύο ημέρες.', 'Εφαρμόζεται, αλλά δεν καταγράφεται πάντα.', 'Μερική ενημέρωση του νέου προσωπικού.'], no: ['Δεν βρέθηκε καταγραφή τον τελευταίο μήνα.', 'Το έντυπο δεν είναι διαθέσιμο στο τμήμα.'] }
const isoDay = days => { const date = new Date(`${hospitalDate()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const plusDays = (day, days) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

async function demoSelfAssessments(organizationId) {
  if (isEmptyPreview()) return []
  const { SYSTEM_TEMPLATES } = await import('../audits/seed/index.js')
  const template = SYSTEM_TEMPLATES.find(item => item.key === 'ward')
  if (!template) return []
  const recent = isoDay(-12)
  // [round, title, released on, due on, departments, status of each, share answered when in progress, quality]
  const rounds = [
    ['2025a', 'Αυτοαξιολόγηση άνοιξης 2025', '2025-03-03', '2025-03-31', DEMO_SELF_DEPARTMENTS, () => 'closed', 1, 0.78],
    ['2025b', 'Αυτοαξιολόγηση φθινοπώρου 2025', '2025-10-01', '2025-10-31', DEMO_SELF_DEPARTMENTS.slice(0, 4), () => 'closed', 1, 0.84],
    ['2026a', 'Αυτοαξιολόγηση άνοιξης 2026', '2026-03-02', '2026-03-31', DEMO_SELF_DEPARTMENTS, index => (index < 4 ? 'closed' : 'submitted'), 1, 0.88],
    ['2026b', 'Αυτοαξιολόγηση Β΄ εξαμήνου 2026', recent, isoDay(18), DEMO_SELF_DEPARTMENTS.slice(0, 4), index => ['submitted', 'released', 'released', 'draft'][index], 0.55, 0.9],
  ]
  return rounds.flatMap(([round, title, released, dueOn, departments, statusOf, share, quality]) => departments.map((departmentName, index) => {
    const status = statusOf(index)
    const rand = seededRandom(`self|${round}|${departmentName}`)
    const answeredShare = status === 'released' ? share * (index === 2 ? 0 : 1) : status === 'draft' ? 0 : 1
    const checklist = selfChecklist(template, departmentName).map(row => {
      if (rand() >= answeredShare) return row
      const roll = rand()
      const answer = roll < quality ? 'yes' : roll < quality + (1 - quality) * 0.55 ? 'partial' : roll < 0.97 ? 'no' : 'na'
      const notes = DEMO_SELF_NOTES[answer]
      return { ...row, answer, note: notes ? notes[Math.floor(rand() * notes.length)] : '' }
    })
    const figures = selfFigures(checklist)
    const submittedAt = status === 'submitted' || status === 'closed' ? `${plusDays(released, 12 + index * 3)}T11:${String(10 + index * 7).padStart(2, '0')}:00.000Z` : ''
    return {
      id: `sa-demo-${round}-${index + 1}`, organizationId, templateId: null, standard: template.standard || '', title, departmentId: departmentName, departmentName, status, dueOn,
      releasedAt: status === 'draft' ? '' : `${released}T08:00:00.000Z`, submittedAt, checklist, totalCount: figures.total, answeredCount: figures.answered, score: figures.answered ? figures.score : null,
      updatedAt: submittedAt || `${released}T08:00:00.000Z`,
    }
  }))
}
