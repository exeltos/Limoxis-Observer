import { CRITERIA } from './resourceModel'
import { isTemplateEvaluation, weightedScore, resultFor } from './supplierTemplates'
import { rowId } from '../qualityRelations'

// A supplier's certifications, evaluations (one score row per criterion), contact
// persons and nonconformities are rows of their own (20261116100000_quality_relational.sql,
// 20261122100000_quality_supplier_eval_templates.sql); the supplier screens keep
// them as lists on the supplier. Pure functions.

export const SUPPLIER_SELECT = '*,certifications:quality_supplier_certifications(*),evaluations:quality_supplier_evaluations(*,scores:quality_supplier_evaluation_scores(*)),nonconformities:quality_supplier_nonconformities(*),contacts:quality_supplier_contacts(*)'
export const TEMPLATE_SELECT = '*,criteria:quality_supplier_eval_template_criteria(*)'
export const CERTIFICATION_FIELDS = ['certificate_type', 'title', 'document_kind', 'certificate_number', 'issuer', 'expires_on']
export const EVALUATION_FIELDS = ['evaluated_on', 'evaluator', 'notes', 'template_id', 'template_name', 'template_version', 'pass_threshold', 'conditional_threshold', 'score_scale', 'total_score', 'result', 'criteria_scores']
export const SCORE_FIELDS = ['criterion', 'criterion_id', 'criterion_label', 'position', 'weight', 'score_scale', 'score']
export const NONCONFORMITY_FIELDS = ['occurred_on', 'description', 'severity', 'status', 'capa_code', 'closed_on']
export const CONTACT_FIELDS = ['position', 'full_name', 'job_title', 'phone', 'email', 'notes']
export const CRITERION_FIELDS = ['position', 'label', 'description', 'weight']

const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const byText = field => (a, b) => String(a[field] || '').localeCompare(String(b[field] || ''))
const byPosition = (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const numberOrNull = value => (value === '' || value == null || Number.isNaN(Number(value)) ? null : Number(value))

export const certificationFromRow = row => ({ id: row.id, type: row.certificate_type || '', title: row.title || '', kind: row.document_kind || 'certificate', number: row.certificate_number || '', issuer: row.issuer || '', expiresOn: row.expires_on || '', attachmentId: row.attachment_id || '' })
export const nonconformityFromRow = row => ({ id: row.id, date: row.occurred_on || '', description: row.description || '', severity: row.severity || 'minor', status: row.status || 'open', capaCode: row.capa_code || '', closedOn: row.closed_on || '' })
export const contactFromRow = row => ({ id: row.id, fullName: row.full_name || '', jobTitle: row.job_title || '', phone: row.phone || '', email: row.email || '', notes: row.notes || '' })

// An evaluation as the screens use it. On a template (or with template scores):
// its snapshot and one entry per criterion scored, by position. An earlier one:
// its scores by the six fixed criteria (a criterion left blank has no row), and
// each criterion's weight when it is not the usual 1.
export function evaluationFromRow(row) {
  const base = { id: row.id, evaluatedOn: row.evaluated_on || '', evaluator: row.evaluator || '', notes: row.notes || '' }
  const rows = row.scores || []
  const templated = row.template_id || row.template_name || rows.some(score => !score.criterion)
  if (templated) {
    return {
      ...base,
      templateId: row.template_id || '', templateName: row.template_name || '', templateVersion: row.template_version || 1,
      passThreshold: numberOrNull(row.pass_threshold) ?? 80, conditionalThreshold: numberOrNull(row.conditional_threshold) ?? 60, scoreScale: Number(row.score_scale) || 5,
      totalScore: numberOrNull(row.total_score), result: row.result || '', criteriaScores: row.criteria_scores || 'complete', periodYear: row.period_year || '', source: row.source || 'app',
      criteria: [...rows].sort(byPosition).map(score => ({ id: score.id, criterionId: score.criterion_id || '', label: score.criterion_label || score.criterion || '', weight: Number(score.weight) || 1, position: Number(score.position) || 0, score: Number(score.score) })),
    }
  }
  const scores = Object.fromEntries(CRITERIA.map(item => [item.key, '']))
  const weights = {}
  for (const score of rows) {
    scores[score.criterion] = Number(score.score)
    if (Number(score.weight) !== 1) weights[score.criterion] = Number(score.weight)
  }
  return { ...base, scores, ...(Object.keys(weights).length ? { weights } : {}) }
}

export function supplierListsFromRow(row = {}) {
  return {
    certifications: [...(row.certifications || [])].sort(byText('created_at')).map(certificationFromRow),
    evaluations: [...(row.evaluations || [])].sort(byText('evaluated_on')).map(evaluationFromRow),
    nonconformities: [...(row.nonconformities || [])].sort(byText('occurred_on')).map(nonconformityFromRow),
    contacts: [...(row.contacts || [])].sort(byPosition).map(contactFromRow),
  }
}

export const certificationRows = (list = []) => list.filter(item => String(item?.type || '').trim()).map(item => ({ id: rowId(item.id), certificate_type: String(item.type).trim(), title: text(item.title), document_kind: item.kind || 'certificate', certificate_number: text(item.number), issuer: text(item.issuer), expires_on: item.expiresOn || null }))
export const nonconformityRows = (list = []) => list.filter(item => item?.date && String(item.description || '').trim()).map(item => {
  const status = item.status === 'closed' ? 'closed' : 'open'
  return { id: rowId(item.id), occurred_on: item.date, description: String(item.description).trim(), severity: item.severity === 'major' ? 'major' : 'minor', status, capa_code: text(item.capaCode), closed_on: status === 'closed' ? item.closedOn || null : null }
})
export const contactRows = (list = []) => list.filter(item => String(item?.fullName || '').trim()).map((item, index) => ({ id: rowId(item.id), position: index, full_name: String(item.fullName).trim(), job_title: text(item.jobTitle), phone: text(item.phone), email: text(item.email), notes: text(item.notes) }))

// The evaluations keep their ids (each score row points at its evaluation). One on a
// template stores its snapshot and its result; an imported one keeps the stored total.
export function evaluationRows(list = []) {
  return list.filter(item => item?.evaluatedOn).map(item => {
    const base = { id: rowId(item.id), evaluated_on: item.evaluatedOn, evaluator: text(item.evaluator), notes: text(item.notes) }
    if (!isTemplateEvaluation(item)) return { ...base, template_id: null, template_name: null, template_version: null, pass_threshold: null, conditional_threshold: null, score_scale: 5, total_score: null, result: null, criteria_scores: 'complete' }
    const complete = (item.criteriaScores || 'complete') === 'complete'
    const total = complete ? weightedScore(item.criteria, item.scoreScale) : numberOrNull(item.totalScore)
    const result = resultFor(total, item.passThreshold, item.conditionalThreshold)
    return {
      ...base,
      template_id: isUuid(item.templateId) ? item.templateId : null, template_name: text(item.templateName), template_version: Number(item.templateVersion) || 1,
      pass_threshold: numberOrNull(item.passThreshold), conditional_threshold: numberOrNull(item.conditionalThreshold), score_scale: Number(item.scoreScale) === 10 ? 10 : 5,
      total_score: total, result: result === 'unevaluated' ? null : result, criteria_scores: item.criteriaScores || 'complete',
    }
  })
}

// The score rows of one evaluation. On a template: one per criterion scored, with
// the criterion's label and weight as scored. An earlier one: one per fixed
// criterion scored 1–5. A stored row of the same criterion keeps its id.
export function scoreRows(evaluation = {}, stored = []) {
  if (isTemplateEvaluation(evaluation)) {
    const scale = Number(evaluation.scoreScale) === 10 ? 10 : 5
    const idOf = new Map(stored.map(row => [row.criterion_id || `label:${row.criterion_label}`, row.id]))
    return (evaluation.criteria || [])
      .map((item, index) => ({ item, index, score: Number(item.score) }))
      .filter(({ item, score }) => item.score !== '' && item.score != null && score >= (scale === 10 ? 0 : 1) && score <= scale)
      .map(({ item, index, score }) => {
        const criterionId = isUuid(item.criterionId) ? item.criterionId : null
        return { id: (isUuid(item.id) && item.id) || idOf.get(criterionId || `label:${item.label}`) || rowId(), criterion: null, criterion_id: criterionId, criterion_label: String(item.label || '').trim() || null, position: index, weight: Number(item.weight) > 0 ? Number(item.weight) : 1, score_scale: scale, score: Math.round(score) }
      })
  }
  const idOf = new Map(stored.map(row => [row.criterion, row.id]))
  return CRITERIA.map(item => ({ criterion: item.key, score: Number(evaluation.scores?.[item.key]), weight: Number(evaluation.weights?.[item.key]) > 0 ? Number(evaluation.weights[item.key]) : 1 }))
    .filter(row => row.score >= 1 && row.score <= 5)
    .map(row => ({ id: idOf.get(row.criterion) || rowId(), ...row, score: Math.round(row.score) }))
}

// Templates and their criteria.
export const templateFromRow = row => ({
  id: row.id, name: row.name || '', description: row.description || '', categories: row.categories || [],
  passThreshold: Number(row.pass_threshold ?? 80), conditionalThreshold: Number(row.conditional_threshold ?? 60), frequencyMonths: Number(row.frequency_months) || 12, scoreScale: Number(row.score_scale) || 5,
  active: row.active !== false, version: Number(row.version) || 1, source: row.source || 'app', updatedAt: row.updated_at || '',
  criteria: [...(row.criteria || [])].sort(byPosition).map(item => ({ id: item.id, label: item.label || '', description: item.description || '', weight: Number(item.weight) || 1 })),
})
export const templateRow = (organizationId, template) => ({
  organization_id: organizationId, name: String(template.name || '').trim(), description: text(template.description), categories: [...new Set(template.categories || [])],
  pass_threshold: Number(template.passThreshold), conditional_threshold: Number(template.conditionalThreshold), frequency_months: Math.round(Number(template.frequencyMonths)), score_scale: Number(template.scoreScale) === 10 ? 10 : 5,
  active: template.active !== false,
})
export const criterionRows = (criteria = []) => criteria.filter(item => String(item?.label || '').trim()).map((item, index) => ({ id: rowId(item.id), position: index, label: String(item.label).trim(), description: text(item.description), weight: Number(item.weight) > 0 ? Number(item.weight) : 1 }))

// Whether saving the template changes what an evaluation would snapshot (its version goes up).
export function templateChanged(before, after) {
  if (!before) return false
  const shape = template => JSON.stringify([template.name, template.passThreshold, template.conditionalThreshold, template.scoreScale, (template.criteria || []).map(item => [String(item.label).trim(), Number(item.weight)])])
  return shape(before) !== shape(after)
}
