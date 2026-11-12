import { AMR_CATEGORY_SELECT, amrCalculationSnapshot } from '../laboratory/amrCalculation'
import type { AnyRecord } from '../../types/featureTypes'

// Rows of the surveillance tables as the records the screens read (clinicalCloudService.ts reads and writes them).

export const iso = value => (value ? new Date(value).toISOString() : null)
export const dateOnly = value => (value ? String(value).slice(0, 10) : null)
const latest = (rows: AnyRecord[] = []) => rows[0] || null
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const byPosition = (a: AnyRecord, b: AnyRecord) => (a.position || 0) - (b.position || 0)
export const textList = (list: AnyRecord[]) =>
  (Array.isArray(list) ? list : []).map(item => String(item ?? '').trim()).filter(Boolean)

// The lists of a record are rows of their own, embedded in the record's query.
export const ASSESSMENT_SELECT =
  '*,findings:clinical_assessment_findings(kind,position,label,value_text,value_numeric,value_boolean)'
export const HAI_SELECT = '*,criteria:hai_classification_criteria(position,criterion_id)'
export const ISOLATION_SELECT = '*,precaution_rows:isolation_episode_precautions(position,precaution)'
export const AMR_SELECT = `*,${AMR_CATEGORY_SELECT}`

// A finding as the assessment lists it: its wording, and the value when one
// was recorded (a fever reading, a date or detail). A risk factor answered
// «no» is not listed.
function findingText(row: AnyRecord) {
  const value = row.value_text ?? (row.value_numeric != null ? String(row.value_numeric) : null)
  return value ? `${row.label}: ${value}` : row.label
}
const findingsOf = (row: AnyRecord, kinds: AnyRecord) =>
  [...(row.findings || [])]
    .filter(item => kinds.includes(item.kind) && item.value_boolean !== false)
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || byPosition(a, b))
    .map(findingText)

export function mapAssessment(row: AnyRecord) {
  if (!row) return null
  return {
    id: row.id,
    date: dateOnly(row.assessed_at),
    assessmentType: row.assessment_type,
    classification: row.classification,
    signsSymptoms: findingsOf(row, ['sign', 'lab_sign']),
    riskFactors: findingsOf(row, ['risk_factor']),
    summary: row.summary || '',
    notes: row.summary || '',
    byId: row.created_by,
  }
}

export function mapHai(row: AnyRecord) {
  if (!row) return null
  return {
    id: row.id,
    status: row.case_status,
    type: row.hai_type,
    definitionSet: row.definition_set,
    definitionVersion: row.definition_version,
    criteriaMet: row.criteria_met,
    criteriaEvidence: [...(row.criteria || [])].sort(byPosition).map(item => item.criterion_id),
    rationale: row.rationale || '',
    classifiedAt: row.classified_at,
    classifiedBy: row.classified_by,
  }
}

function mapAmr(row: AnyRecord) {
  if (!row) return null
  return {
    id: row.id,
    classification: row.classification,
    status: row.status,
    definitionSource: row.definition_source,
    definitionVersion: row.definition_version,
    calculationSnapshot: amrCalculationSnapshot(row),
    rationale: row.rationale || '',
    classifiedAt: row.classified_at,
    classifiedBy: row.classified_by,
  }
}

interface MapMicrobiologyResultOptions {
  amrRows?: AnyRecord[]
  astRows?: AnyRecord[]
  communications?: AnyRecord[]
}
function mapMicrobiologyResult(row: AnyRecord, { amrRows = [], astRows = [], communications = [] }: MapMicrobiologyResultOptions = {}) {
  if (!row) return null
  return {
    id: row.id,
    status: row.result_status,
    organism: row.organism,
    resistanceClass: row.resistance_class,
    susceptibilitySummary: row.susceptibility_summary,
    critical: row.is_critical,
    resultedAt: row.resulted_at,
    validationStatus: row.validation_status,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    method: row.method,
    preliminary: row.preliminary,
    interpretationStandard: row.interpretation_standard,
    interpretationVersion: row.interpretation_version,
    amr: mapAmr(latest(amrRows.filter(item => item.microbiology_result_id === row.id))),
    ast: astRows
      .filter(item => item.microbiology_result_id === row.id)
      .map(item => ({
        id: item.id,
        antimicrobial: item.antimicrobial_name,
        method: item.method,
        micValue: item.mic_value,
        diskZoneMm: item.zone_diameter_mm,
        interpretation: item.sir_category,
        breakpointStandard: item.breakpoint_standard,
        breakpointVersion: item.breakpoint_version,
        breakpointValue: null,
        testedAt: item.created_at,
      })),
    communications: communications
      .filter(item => item.microbiology_result_id === row.id)
      .map(item => ({
        id: item.id,
        at: item.communicated_at,
        byId: item.communicated_by,
        recipient: item.recipient_name,
        recipientRole: item.recipient_role,
        channel: item.communication_method,
        readBackConfirmed: item.read_back_confirmed,
        notes: item.notes || '',
      })),
  }
}

export function mapSample(row: AnyRecord, related: AnyRecord = {}) {
  const results = (related.results || [])
    .filter((item: AnyRecord) => item.sample_id === row.id)
    .map((item: AnyRecord) => mapMicrobiologyResult(item, related))
  const validated =
    results.find((item: AnyRecord) => item.validationStatus === 'validated') || results[0] || null
  return {
    id: row.sample_code,
    recordId: row.id,
    type: row.sample_type,
    source: row.source_site,
    collectedAt: row.collected_at,
    receivedAt: row.received_at,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    status: row.status,
    result: validated?.status || null,
    organism: validated?.organism || null,
    resistance: validated?.amr?.classification || validated?.resistanceClass || null,
    critical: Boolean(validated?.critical),
    priority: row.priority,
    surveillanceCaseId: row.surveillance_case_id,
    microbiologyResults: results,
  }
}

// An isolation is active while its status is 'active' and it has not ended
// (as patient_infection_flags and analysis_domain_metrics count it).
const isolationActive = (row: AnyRecord) => row?.status === 'active' && !row.ended_at

export function mapIsolation(row: AnyRecord) {
  if (!row) return null
  return {
    id: row.id,
    precautions: [...(row.precaution_rows || [])].sort(byPosition).map(item => item.precaution),
    room: row.room || '',
    reason: row.reason || '',
    startedAt: row.started_at,
    reviewDue: row.review_due_at,
    endedAt: row.ended_at,
    endReason: row.end_reason || '',
    status: row.status === 'active' && !isolationActive(row) ? 'ended' : row.status,
    createdBy: row.created_by,
    endedBy: row.ended_by,
  }
}

export function mapAdministration(row: AnyRecord) {
  return {
    id: row.id,
    therapyId: row.therapy_id,
    administeredAt: row.administered_at,
    dose: row.dose || '',
    route: row.route || '',
    status: row.status,
    withheldReason: row.withheld_reason || '',
    administeredBy: row.administered_by,
    notes: row.notes || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function mapTherapy(row: AnyRecord, administrations: AnyRecord[] = []) {
  return {
    id: row.id,
    antimicrobial: row.antimicrobial,
    dose: row.dose || '',
    route: row.route || '',
    indication: row.indication || '',
    startedAt: row.started_at,
    plannedEndAt: row.planned_end_at,
    endedAt: row.ended_at,
    approvalStatus: row.approval_status,
    status: row.status,
    createdBy: row.created_by,
    administrations: administrations.filter(a => a.therapy_id === row.id).map(mapAdministration),
  }
}

export function mapDevice(row: AnyRecord) {
  return {
    id: row.id,
    name: row.device_type,
    nameEn: row.device_type,
    site: row.site,
    siteEn: row.site,
    indication: row.indication,
    indicationEn: row.indication,
    insertedAt: row.inserted_at,
    reviewDue: row.review_due_at,
    removedAt: row.removed_at,
    status: row.status,
    createdBy: row.created_by,
  }
}

// UI reassessment vocabulary -> surveillance_reassessments check constraints (clinical_status / *_decision).
const reassessmentStatusToDb: Record<string, string> = {
  clinicalImprovement: 'improved',
  improvement: 'improved',
  deterioration: 'deteriorated',
  worsened: 'deteriorated',
}
const reassessmentStatusFromDb: Record<string, string> = { improved: 'clinicalImprovement', deteriorated: 'deterioration' }
const reassessmentDecisionToDb: Record<string, string> = {
  continueTreatment: 'continue',
  continueIsolation: 'continue',
  modifyTreatment: 'modify',
  modifyIsolation: 'modify',
  stopTreatment: 'stop',
  discontinueIsolation: 'discontinue',
}
const reassessmentStatuses = ['improved', 'stable', 'deteriorated', 'resolved', 'undetermined']
export const reassessmentStatusDbValue = value => {
  const v = reassessmentStatusToDb[value] || value
  return reassessmentStatuses.includes(v) ? v : 'undetermined'
}
export const reassessmentStatusUiValue = value => reassessmentStatusFromDb[value] || value
export const reassessmentDecisionDbValue = (
  value,
  allowed = ['continue', 'modify', 'stop', 'not_applicable'],
) => {
  if (!value) return null
  const v = reassessmentDecisionToDb[value] || value
  return allowed.includes(v) ? v : null
}

export function mapReassessment(row: AnyRecord) {
  return {
    id: row.id,
    date: dateOnly(row.reassessed_at),
    status: reassessmentStatusUiValue(row.clinical_status),
    decision: row.isolation_decision || row.therapy_decision || '',
    isolationDecision: row.isolation_decision,
    therapyDecision: row.therapy_decision,
    notes: row.notes || '',
    nextReviewDue: dateOnly(row.next_review_due_at),
    byId: row.created_by,
  }
}

export function mapOutcome(row: AnyRecord) {
  if (!row) return null
  return {
    id: row.id,
    status: row.outcome,
    date: dateOnly(row.occurred_at),
    notes: row.notes || '',
    recordedById: row.created_by,
  }
}

interface ClinicalTimelineOptions {
  events?: AnyRecord[]
  assessments?: AnyRecord[]
  hai?: AnyRecord[]
  samples?: AnyRecord[]
  therapies?: AnyRecord[]
  isolations?: AnyRecord[]
  reassessments?: AnyRecord[]
  outcomes?: AnyRecord[]
  devices?: AnyRecord[]
}
function clinicalTimeline({
  events = [],
  assessments = [],
  hai = [],
  samples = [],
  therapies = [],
  isolations = [],
  reassessments = [],
  outcomes = [],
  devices = [],
}: ClinicalTimelineOptions) {
  return [
    ...events.map(row => ({
      at: row.occurred_at || row.created_at,
      type: row.event_type,
      actorId: row.created_by,
      // «created» / «completed» only repeat the event's own name.
      detail: row.detail && row.detail !== 'created' ? row.detail : '',
    })),
    ...assessments.map(row => ({
      at: row.assessed_at,
      type: 'clinical_assessment',
      actorId: row.created_by,
      detail: row.classification || row.assessment_type,
    })),
    ...hai.map(row => ({
      at: row.classified_at,
      type: 'hai_classification',
      actorId: row.classified_by,
      detail: `${row.hai_type} · ${row.case_status}`,
    })),
    ...samples.map(row => ({
      at: row.requested_at || row.collected_at || row.created_at,
      type: 'sample_requested',
      actorId: row.requested_by || row.created_by,
      detail: row.sample_code,
    })),
    ...therapies.map(row => ({
      at: row.started_at,
      type: 'therapy_started',
      actorId: row.created_by,
      detail: row.antimicrobial,
    })),
    ...isolations.map(row => ({
      at: row.started_at,
      type: 'isolation_started',
      actorId: row.created_by,
      detail: row.reason,
    })),
    ...reassessments.map(row => ({
      at: row.reassessed_at,
      type: 'reassessment',
      actorId: row.created_by,
      detail: reassessmentStatusUiValue(row.clinical_status),
    })),
    ...outcomes.map(row => ({
      at: row.occurred_at,
      type: 'outcome',
      actorId: row.created_by,
      detail: row.outcome,
    })),
    ...devices.map(row => ({
      at: row.inserted_at || row.created_at,
      type: 'device_added',
      actorId: row.created_by,
      detail: row.device_type,
    })),
  ]
    .filter(item => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

interface MapClinicalCaseOptions {
  caseRow: AnyRecord
  patient: AnyRecord
  department: AnyRecord
  events?: AnyRecord[]
  assessments?: AnyRecord[]
  hai?: AnyRecord[]
  samples?: AnyRecord[]
  relatedLab?: AnyRecord
  therapies?: AnyRecord[]
  therapyAdministrations?: AnyRecord[]
  isolations?: AnyRecord[]
  reassessments?: AnyRecord[]
  outcomes?: AnyRecord[]
  devices?: AnyRecord[]
}
export function mapClinicalCase({
  caseRow,
  patient,
  department,
  events = [],
  assessments = [],
  hai = [],
  samples = [],
  relatedLab = {},
  therapies = [],
  therapyAdministrations = [],
  isolations = [],
  reassessments = [],
  outcomes = [],
  devices = [],
}: MapClinicalCaseOptions) {
  const caseAssessments = assessments.filter(row => row.surveillance_case_id === caseRow.id)
  const caseHai = hai.filter(row => row.surveillance_case_id === caseRow.id)
  const caseSamples = samples.filter(row => row.surveillance_case_id === caseRow.id)
  const caseTherapies = therapies.filter(row => row.surveillance_case_id === caseRow.id)
  const caseIsolations = isolations.filter(row => row.surveillance_case_id === caseRow.id)
  const caseReassessments = reassessments.filter(row => row.surveillance_case_id === caseRow.id)
  const caseOutcomes = outcomes.filter(row => row.surveillance_case_id === caseRow.id)
  const caseDevices = devices.filter(row => row.surveillance_case_id === caseRow.id)
  const isolationRecord =
    caseIsolations.find(isolationActive) || latest(caseIsolations)
  const isolationDecision = isolationRecord
    ? {
        required: true,
        decidedAt: isolationRecord.started_at || isolationRecord.created_at || null,
        by: isolationRecord.created_by || null,
      }
    : caseRow.isolation_required === false
      ? {
          required: false,
          decidedAt: caseRow.isolation_decided_at || null,
          by: caseRow.isolation_decided_by || null,
        }
      : null
  return {
    id: caseRow.id,
    recordId: caseRow.id,
    createdBy: caseRow.created_by || null,
    patientRecordId: caseRow.patient_id,
    patientId: patient?.patient_code || caseRow.patient_id,
    patient: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
    patientEn: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
    dateOfBirth: patient?.date_of_birth || null,
    departmentId: caseRow.department_id,
    department: department?.name || '',
    departmentEn: department?.name || '',
    admissionDate: patient?.admission_date || null,
    startedAt: caseRow.started_at,
    reviewDue: caseRow.review_due_on || null,
    room: caseRow.room || '',
    reason: caseRow.reason || '',
    reasonEn: caseRow.reason_en || caseRow.reason || '',
    suspectedSource: caseRow.suspected_source || '',
    status: caseRow.status,
    completedAt: caseRow.closed_at,
    closeReason: caseRow.close_reason,
    assessment: mapAssessment(latest(caseAssessments)),
    assessments: caseAssessments.map(mapAssessment),
    haiClassification: mapHai(latest(caseHai)),
    haiClassifications: caseHai.map(mapHai),
    isolation: mapIsolation(isolationRecord),
    isolationDecision,
    isolations: caseIsolations.map(mapIsolation),
    therapy: caseTherapies.map(row => mapTherapy(row, therapyAdministrations)),
    samples: caseSamples.map(row => mapSample(row, relatedLab)),
    reassessments: caseReassessments.map(mapReassessment),
    outcome: mapOutcome(latest(caseOutcomes)),
    devices: caseDevices.map(mapDevice),
    timeline: clinicalTimeline({
      events,
      assessments: caseAssessments,
      hai: caseHai,
      samples: caseSamples,
      therapies: caseTherapies,
      isolations: caseIsolations,
      reassessments: caseReassessments,
      outcomes: caseOutcomes,
      devices: caseDevices,
    }),
    reopenedAt: caseRow.reopened_at,
    reopenReason: caseRow.reopen_reason,
  }
}
