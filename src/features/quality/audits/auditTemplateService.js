import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { diffChildRows, isUuid, rowId } from '../qualityRelations'

// The audit questionnaires (20261124100000_quality_audit_programme.sql): the
// platform library every hospital reads, and the hospital's own copies. The
// demo keeps its copies in the browser, next to the library from the seed.

const LOCAL_KEY = 'quality_local_audit_templates'
const must = ({ data, error }) => { if (error) throw error; return data }
const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const SELECT = '*,questions:quality_audit_template_questions(*)'
export const QUESTION_FIELDS = ['position', 'chapter_ref', 'chapter_title', 'clause_ref', 'question', 'guidance', 'evidence', 'weight', 'critical', 'areas']

export const templateFromRow = row => ({
  id: row.id,
  organizationId: row.organization_id || null,
  isSystem: Boolean(row.is_system),
  basedOn: row.based_on || null,
  key: row.template_key || '',
  standard: row.standard,
  standardVersion: row.standard_version || '',
  title: row.title || '',
  description: row.description || '',
  scope: row.scope || '',
  departmentTypes: row.department_types || [],
  active: row.active !== false,
  version: row.version || 1,
  source: row.source || 'app',
  updatedAt: row.updated_at || null,
  questions: [...(row.questions || [])].sort((a, b) => a.position - b.position).map(item => ({
    id: item.id,
    position: item.position,
    chapterRef: item.chapter_ref || '',
    chapterTitle: item.chapter_title || '',
    clauseRef: item.clause_ref || '',
    question: item.question || '',
    guidance: item.guidance || '',
    evidence: item.evidence || '',
    weight: Number(item.weight) || 1,
    critical: Boolean(item.critical),
    areas: item.areas || [],
  })),
})

const templateRow = (organizationId, template) => ({
  organization_id: template.isSystem ? null : organizationId,
  is_system: Boolean(template.isSystem),
  based_on: isUuid(template.basedOn) ? template.basedOn : null,
  template_key: text(template.key),
  standard: template.standard || 'other',
  standard_version: text(template.standardVersion),
  title: String(template.title || '').trim(),
  description: text(template.description),
  scope: text(template.scope),
  department_types: template.departmentTypes || [],
  active: template.active !== false,
  source: template.source || 'app',
})

// The questions in order; a question without text is not kept.
export function questionRows(questions = []) {
  return questions.filter(item => String(item?.question || '').trim()).map((item, index) => ({
    id: rowId(item.id),
    position: index + 1,
    chapter_ref: String(item.chapterRef || '').trim(),
    chapter_title: text(item.chapterTitle),
    clause_ref: String(item.clauseRef || '').trim(),
    question: String(item.question).trim(),
    guidance: text(item.guidance),
    evidence: text(item.evidence),
    weight: Number(item.weight) > 0 ? Number(item.weight) : 1,
    critical: Boolean(item.critical),
    areas: item.areas || [],
  }))
}

// What a change of a questionnaire raises its version for.
export function templateChanged(before, after) {
  if (!before) return false
  const strip = template => JSON.stringify({ title: template.title, standard: template.standard, scope: template.scope, departmentTypes: template.departmentTypes, questions: questionRows(template.questions).map(({ id: _id, ...rest }) => rest) })
  return strip(before) !== strip(after)
}

async function systemTemplates() {
  const { SYSTEM_TEMPLATES } = await import('./seed/index.js')
  return structuredClone(SYSTEM_TEMPLATES)
}

function localCopies() {
  const rows = loadSnapshot(LOCAL_KEY, [])
  return Array.isArray(rows) ? rows : []
}

// The library and the hospital's copies: the hospital's first, then the platform's.
export async function loadAuditTemplates(organizationId) {
  if (isDemoDataEnvironment()) return [...localCopies(), ...(await systemTemplates())]
  if (!supabase) return []
  const query = supabase.from('quality_audit_templates').select(SELECT).order('is_system').order('title')
  const rows = must(organizationId ? await query.or(`is_system.eq.true,organization_id.eq.${organizationId}`) : await query.eq('is_system', true))
  return (rows || []).map(templateFromRow)
}

// Saves a hospital's questionnaire (or, for the Platform Owner, one of the
// library) with its questions; a change raises its version.
export async function saveAuditTemplate(organizationId, template, before = null) {
  const version = (Number(before?.version) || Number(template.version) || 1) + (templateChanged(before, template) ? 1 : 0)
  if (isDemoDataEnvironment()) {
    const rows = localCopies()
    const next = { ...template, isSystem: false, id: template.id && !String(template.id).startsWith('system-') ? template.id : localId('aqt'), version, questions: (template.questions || []).filter(item => String(item.question || '').trim()).map((item, index) => ({ ...item, id: item.id || localId('aqq'), position: index + 1 })) }
    saveSnapshot(LOCAL_KEY, rows.some(item => item.id === next.id) ? rows.map(item => (item.id === next.id ? next : item)) : [next, ...rows])
    return next
  }
  let id = template.id
  if (isUuid(id)) must(await supabase.from('quality_audit_templates').update({ ...templateRow(organizationId, template), version }).eq('id', id).select('id').single())
  else id = must(await supabase.from('quality_audit_templates').insert({ ...templateRow(organizationId, template), version: 1 }).select('id').single()).id
  const owner = template.isSystem ? null : organizationId
  const existing = must(await supabase.from('quality_audit_template_questions').select(['id', ...QUESTION_FIELDS].join(',')).eq('template_id', id)) || []
  const { upsert, remove } = diffChildRows(existing, questionRows(template.questions), QUESTION_FIELDS)
  if (remove.length) must(await supabase.from('quality_audit_template_questions').delete().eq('template_id', id).in('id', remove))
  if (upsert.length) must(await supabase.from('quality_audit_template_questions').upsert(upsert.map(row => ({ ...row, template_id: id, organization_id: owner }))))
  return templateFromRow(must(await supabase.from('quality_audit_templates').select(SELECT).eq('id', id).single()))
}

// A hospital's own copy of a questionnaire of the library, to edit.
export function copyOfTemplate(template, language = 'el') {
  return {
    ...structuredClone(template),
    id: null,
    isSystem: false,
    basedOn: template.isSystem ? template.id : template.basedOn || template.id,
    title: `${template.title} ${language === 'en' ? '(hospital copy)' : '(αντίγραφο νοσοκομείου)'}`,
    version: 1,
    source: 'app',
    questions: (template.questions || []).map(item => ({ ...item, id: null })),
  }
}

export async function removeAuditTemplate(organizationId, id) {
  if (isDemoDataEnvironment()) { saveSnapshot(LOCAL_KEY, localCopies().filter(item => item.id !== id)); return }
  must(await supabase.from('quality_audit_templates').delete().eq('id', id).eq('organization_id', organizationId))
}

export const newQuestion = (chapter = {}) => ({ id: null, chapterRef: chapter.ref || '', chapterTitle: chapter.title || '', clauseRef: chapter.ref || '', question: '', guidance: '', evidence: '', weight: 1, critical: false, areas: [] })
export const newAuditTemplate = () => ({ id: null, isSystem: false, basedOn: null, key: '', standard: 'other', standardVersion: '', title: '', description: '', scope: '', departmentTypes: [], active: true, version: 1, source: 'app', questions: [] })
