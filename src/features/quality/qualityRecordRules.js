// Rules of a quality record (incident, finding, CAPA, audit): its statuses,
// when it counts as finalized, its responsible people, and the checks on save.
import { subActionProgress } from './qualityDeviations'
import { isSentinelHarm } from './qualityVocabulary'

const STATUSES = {
  incidents: ['reported', 'underReview', 'closed'],
  findings: ['open', 'inProgress', 'closed'],
  capas: ['open', 'inProgress', 'verification', 'closed'],
}
const AUDIT_STATUSES = ['planned', 'inProgress', 'completed', 'cancelled']

export function statusOptions(recordType) {
  return STATUSES[recordType] || AUDIT_STATUSES
}

// A closed, completed or cancelled record is only changed through a governed
// correction with a reason.
export function isFinalizedQualityRecord(record) {
  return Boolean(record && ['closed', 'completed', 'cancelled'].includes(record.status))
}

// Responsible people: the `owners` list, or the single legacy `owner`.
export function recordOwners(record) {
  return record.owners?.length ? record.owners : [record.owner].filter(Boolean)
}

export function withOwnerAdded(record, name) {
  const value = String(name || '').trim()
  if (!value) return record
  return { ...record, owner: '', owners: [...new Set([...recordOwners(record), value])] }
}

export function withOwnerRemoved(record, name) {
  return { ...record, owners: recordOwners(record).filter(owner => owner !== name), owner: '' }
}

// Open steps that stop a CAPA from moving to verification or closing. Zero
// when the CAPA is already there, or the record is not a CAPA.
export function openStepsBlockingCapa(recordType, draft, saved) {
  if (recordType !== 'capas') return 0
  const finishing = status => ['verification', 'closed'].includes(status)
  if (!finishing(draft.status) || finishing(saved.status)) return 0
  return subActionProgress(draft.subActions || []).open
}

// An incident's class sets whether it reached the patient and caused harm. A
// harmful incident cannot keep impact 'none'; any other class has no impact.
export function withIncidentClass(record, incidentClass) {
  const harmful = incidentClass === 'harmful'
  return {
    ...record,
    incidentClass,
    reachedPatient: incidentClass !== 'nearMiss',
    harmOccurred: harmful,
    impact: harmful ? (!record.impact || record.impact === 'none' ? 'mild' : record.impact) : 'none',
    sentinel: harmful ? Boolean(record.sentinel) : false,
  }
}

// The harm level of an incident. Death or severe harm makes it a sentinel
// event; a sentinel marked by hand stays one when the harm is lowered.
export function withHarm(record, impact) {
  const manual = Boolean(record.sentinel) && !isSentinelHarm(record.impact)
  return { ...record, impact, sentinel: isSentinelHarm(impact) || manual }
}

// Where an incident stands in its flow (ISO 9001 §10.2): reported → assessed →
// CAPA → CAPA effective → closed. A closed incident without a CAPA did not
// need one. Each step is done, current, skipped or todo.
export function incidentFlow(record, capas = []) {
  const linked = capas.filter(capa => capa.lifecycleStatus !== 'voided')
  const closed = record?.status === 'closed'
  const assessed = closed || record?.status === 'underReview'
  const hasCapa = linked.length > 0
  const effective = linked.some(capa => capa.effectivenessStatus === 'effective')
  const state = [
    ['reported', 'done'],
    ['assessment', assessed ? 'done' : 'current'],
    ['capa', hasCapa ? 'done' : closed ? 'skipped' : assessed ? 'current' : 'todo'],
    ['effectiveness', effective ? 'done' : !hasCapa ? (closed ? 'skipped' : 'todo') : 'current'],
    ['closed', closed ? 'done' : effective || (assessed && !hasCapa) ? 'current' : 'todo'],
  ]
  // Only the first unfinished step is current.
  let seen = false
  return state.map(([id, status]) => {
    if (status === 'current') { if (seen) return { id, status: 'todo' }; seen = true }
    return { id, status }
  })
}
