import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { selfChecklist, selfFigures } from './selfAssessmentModel'

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
  if (isDemoDataEnvironment()) return local()
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
