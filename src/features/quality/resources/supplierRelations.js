import { CRITERIA } from './resourceModel'
import { rowId } from '../qualityRelations'

// A supplier's certifications, evaluations (one score row per criterion) and
// nonconformities are rows of their own (20261116100000_quality_relational.sql);
// the supplier screens keep them as lists on the supplier. Pure functions.

export const SUPPLIER_SELECT = '*,certifications:quality_supplier_certifications(*),evaluations:quality_supplier_evaluations(*,scores:quality_supplier_evaluation_scores(*)),nonconformities:quality_supplier_nonconformities(*)'
export const CERTIFICATION_FIELDS = ['certificate_type', 'certificate_number', 'issuer', 'expires_on']
export const EVALUATION_FIELDS = ['evaluated_on', 'evaluator', 'notes']
export const SCORE_FIELDS = ['criterion', 'weight', 'score']
export const NONCONFORMITY_FIELDS = ['occurred_on', 'description', 'severity', 'status', 'capa_code', 'closed_on']

const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const byText = field => (a, b) => String(a[field] || '').localeCompare(String(b[field] || ''))

export const certificationFromRow = row => ({ id: row.id, type: row.certificate_type || '', number: row.certificate_number || '', issuer: row.issuer || '', expiresOn: row.expires_on || '' })
export const nonconformityFromRow = row => ({ id: row.id, date: row.occurred_on || '', description: row.description || '', severity: row.severity || 'minor', status: row.status || 'open', capaCode: row.capa_code || '', closedOn: row.closed_on || '' })
// An evaluation's scores by criterion (a criterion left blank has no row), and
// each criterion's weight when it is not the usual 1.
export function evaluationFromRow(row) {
  const scores = Object.fromEntries(CRITERIA.map(item => [item.key, '']))
  const weights = {}
  for (const score of row.scores || []) {
    scores[score.criterion] = Number(score.score)
    if (Number(score.weight) !== 1) weights[score.criterion] = Number(score.weight)
  }
  return { id: row.id, evaluatedOn: row.evaluated_on || '', evaluator: row.evaluator || '', scores, ...(Object.keys(weights).length ? { weights } : {}), notes: row.notes || '' }
}

export function supplierListsFromRow(row = {}) {
  return {
    certifications: [...(row.certifications || [])].sort(byText('created_at')).map(certificationFromRow),
    evaluations: [...(row.evaluations || [])].sort(byText('evaluated_on')).map(evaluationFromRow),
    nonconformities: [...(row.nonconformities || [])].sort(byText('occurred_on')).map(nonconformityFromRow),
  }
}

export const certificationRows = (list = []) => list.filter(item => String(item?.type || '').trim()).map(item => ({ id: rowId(item.id), certificate_type: String(item.type).trim(), certificate_number: text(item.number), issuer: text(item.issuer), expires_on: item.expiresOn || null }))
export const nonconformityRows = (list = []) => list.filter(item => item?.date && String(item.description || '').trim()).map(item => {
  const status = item.status === 'closed' ? 'closed' : 'open'
  return { id: rowId(item.id), occurred_on: item.date, description: String(item.description).trim(), severity: item.severity === 'major' ? 'major' : 'minor', status, capa_code: text(item.capaCode), closed_on: status === 'closed' ? item.closedOn || null : null }
})
// The evaluations keep their ids (each score row points at its evaluation).
export const evaluationRows = (list = []) => list.filter(item => item?.evaluatedOn).map(item => ({ id: rowId(item.id), evaluated_on: item.evaluatedOn, evaluator: text(item.evaluator), notes: text(item.notes) }))

// The score rows of one evaluation: one per criterion scored 1–5; a stored row
// of the same criterion keeps its id.
export function scoreRows(evaluation = {}, stored = []) {
  const idOf = new Map(stored.map(row => [row.criterion, row.id]))
  return CRITERIA.map(item => ({ criterion: item.key, score: Number(evaluation.scores?.[item.key]), weight: Number(evaluation.weights?.[item.key]) > 0 ? Number(evaluation.weights[item.key]) : 1 }))
    .filter(row => row.score >= 1 && row.score <= 5)
    .map(row => ({ id: idOf.get(row.criterion) || rowId(), ...row, score: Math.round(row.score) }))
}
