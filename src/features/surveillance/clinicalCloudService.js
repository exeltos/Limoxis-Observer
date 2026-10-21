import { groupByColumn, selectAllPages, selectInChunks } from '../../core/data/inChunks'
import { supabase } from '../../core/supabase/client'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'
import { AMR_CATEGORY_SELECT, amrCalculationSnapshot } from '../laboratory/amrCalculation'

const iso = value => (value ? new Date(value).toISOString() : null)
const dateOnly = value => (value ? String(value).slice(0, 10) : null)
const latest = (rows = []) => rows[0] || null
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const byPosition = (a, b) => (a.position || 0) - (b.position || 0)
const textList = list =>
  (Array.isArray(list) ? list : []).map(item => String(item ?? '').trim()).filter(Boolean)

// The lists of a record are rows of their own, embedded in the record's query.
const ASSESSMENT_SELECT =
  '*,findings:clinical_assessment_findings(kind,position,label,value_text,value_numeric,value_boolean)'
const HAI_SELECT = '*,criteria:hai_classification_criteria(position,criterion_id)'
const ISOLATION_SELECT = '*,precaution_rows:isolation_episode_precautions(position,precaution)'
const AMR_SELECT = `*,${AMR_CATEGORY_SELECT}`

// A finding as the assessment lists it: its wording, and the value when one
// was recorded (a fever reading, a date or detail). A risk factor answered
// «no» is not listed.
function findingText(row) {
  const value = row.value_text ?? (row.value_numeric != null ? String(row.value_numeric) : null)
  return value ? `${row.label}: ${value}` : row.label
}
const findingsOf = (row, kinds) =>
  [...(row.findings || [])]
    .filter(item => kinds.includes(item.kind) && item.value_boolean !== false)
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || byPosition(a, b))
    .map(findingText)

function mapAssessment(row) {
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

function mapHai(row) {
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

function mapAmr(row) {
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

function mapMicrobiologyResult(row, { amrRows = [], astRows = [], communications = [] } = {}) {
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

function mapSample(row, related = {}) {
  const results = (related.results || [])
    .filter(item => item.sample_id === row.id)
    .map(item => mapMicrobiologyResult(item, related))
  const validated =
    results.find(item => item.validationStatus === 'validated') || results[0] || null
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
const isolationActive = row => row?.status === 'active' && !row.ended_at

function mapIsolation(row) {
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

function mapAdministration(row) {
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

function mapTherapy(row, administrations = []) {
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

function mapDevice(row) {
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
const reassessmentStatusToDb = {
  clinicalImprovement: 'improved',
  improvement: 'improved',
  deterioration: 'deteriorated',
  worsened: 'deteriorated',
}
const reassessmentStatusFromDb = { improved: 'clinicalImprovement', deteriorated: 'deterioration' }
const reassessmentDecisionToDb = {
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

function mapReassessment(row) {
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

function mapOutcome(row) {
  if (!row) return null
  return {
    id: row.id,
    status: row.outcome,
    date: dateOnly(row.occurred_at),
    notes: row.notes || '',
    recordedById: row.created_by,
  }
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
}) {
  return [
    ...events.map(row => ({
      at: row.occurred_at || row.created_at,
      type: row.event_type,
      actorId: row.created_by,
      detail: row.detail || row.event_status,
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
    .sort((a, b) => new Date(b.at) - new Date(a.at))
}

function mapClinicalCase({
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
}) {
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

// Rows of `table` whose `column` is one of `ids`, newest first by `orderColumn`.
// Many ids are read as the organization's whole list (see selectInChunks).
function relatedRows(organizationId, table, select, column, ids, orderColumn, orderOptions) {
  const ordered = query => query.order(orderColumn, orderOptions).order('id', { ascending: true })
  return selectInChunks(ids, chunk => ordered(supabase.from(table).select(select).in(column, chunk)), {
    order: [[orderColumn, orderOptions]],
    column,
    whole: organizationId
      ? () => ordered(supabase.from(table).select(select).eq('organization_id', organizationId))
      : undefined,
  })
}

const NEWEST = { ascending: false }
const NEWEST_NULLS_LAST = { ascending: false, nullsFirst: false }

async function hydrateCases(caseRows) {
  if (!caseRows?.length) return []
  const organizationId = caseRows[0].organization_id
  const caseIds = caseRows.map(row => row.id)
  const patientIds = [...new Set(caseRows.map(row => row.patient_id))]
  const departmentIds = [...new Set(caseRows.map(row => row.department_id).filter(Boolean))]
  const related = (table, select, ids, orderColumn, orderOptions, column = 'surveillance_case_id') =>
    relatedRows(organizationId, table, select, column, ids, orderColumn, orderOptions)
  const [
    patientsResult,
    departmentsResult,
    eventsResult,
    assessmentsResult,
    haiResult,
    samplesResult,
    therapiesResult,
    isolationsResult,
    reassessmentsResult,
    outcomesResult,
    devicesResult,
  ] = await Promise.all([
    related('patients', 'id,patient_code,first_name,last_name,date_of_birth,admission_date,status', patientIds, 'created_at', NEWEST, 'id'),
    related('departments', 'id,name', departmentIds, 'name', { ascending: true }, 'id'),
    related('surveillance_events', '*', caseIds, 'created_at', NEWEST),
    related('clinical_assessments', ASSESSMENT_SELECT, caseIds, 'assessed_at', NEWEST),
    related('hai_classifications', HAI_SELECT, caseIds, 'classified_at', NEWEST),
    related('laboratory_samples', '*', caseIds, 'requested_at', NEWEST_NULLS_LAST),
    related('antimicrobial_therapies', '*', caseIds, 'started_at', NEWEST),
    related('isolation_episodes', ISOLATION_SELECT, caseIds, 'started_at', NEWEST),
    related('surveillance_reassessments', '*', caseIds, 'reassessed_at', NEWEST),
    related('surveillance_outcomes', '*', caseIds, 'occurred_at', NEWEST),
    related('surveillance_devices', '*', caseIds, 'inserted_at', NEWEST_NULLS_LAST),
  ])
  const baseResults = [
    patientsResult,
    departmentsResult,
    eventsResult,
    assessmentsResult,
    haiResult,
    samplesResult,
    therapiesResult,
    isolationsResult,
    reassessmentsResult,
    outcomesResult,
    devicesResult,
  ]
  for (const result of baseResults) if (result.error) throw result.error

  const samples = samplesResult.data || []
  const therapies = therapiesResult.data || []
  const [labResults, administrationsResult] = await Promise.all([
    loadRelatedLab(related, samples.map(row => row.id)),
    therapies.length
      ? related('antimicrobial_therapy_administrations', '*', therapies.map(row => row.id), 'administered_at', NEWEST, 'therapy_id')
      : { data: [], error: null },
  ])
  if (administrationsResult.error) throw administrationsResult.error

  // Each case gets only its own rows, so mapping stays linear in the data.
  const bySampleResult = {
    amrRows: groupByColumn(labResults.amrRows, 'microbiology_result_id'),
    astRows: groupByColumn(labResults.astRows, 'microbiology_result_id'),
    communications: groupByColumn(labResults.communications, 'microbiology_result_id'),
  }
  const resultsBySample = groupByColumn(labResults.results, 'sample_id')
  const administrationsByTherapy = groupByColumn(administrationsResult.data, 'therapy_id')
  const patients = new Map((patientsResult.data || []).map(row => [row.id, row]))
  const departments = new Map((departmentsResult.data || []).map(row => [row.id, row]))
  const byCase = rows => groupByColumn(rows, 'surveillance_case_id')
  const grouped = {
    events: byCase(eventsResult.data),
    assessments: byCase(assessmentsResult.data),
    hai: byCase(haiResult.data),
    samples: byCase(samples),
    therapies: byCase(therapies),
    isolations: byCase(isolationsResult.data),
    reassessments: byCase(reassessmentsResult.data),
    outcomes: byCase(outcomesResult.data),
    devices: byCase(devicesResult.data),
  }
  const forCase = (key, caseId) => grouped[key].get(caseId) || []
  const pick = (groups, ids) => ids.flatMap(id => groups.get(id) || [])

  return caseRows.map(caseRow => {
    const caseSamples = forCase('samples', caseRow.id)
    const caseResults = pick(resultsBySample, caseSamples.map(row => row.id))
    const resultIds = caseResults.map(row => row.id)
    const caseTherapies = forCase('therapies', caseRow.id)
    return mapClinicalCase({
      caseRow,
      patient: patients.get(caseRow.patient_id),
      department: departments.get(caseRow.department_id),
      events: forCase('events', caseRow.id),
      assessments: forCase('assessments', caseRow.id),
      hai: forCase('hai', caseRow.id),
      samples: caseSamples,
      relatedLab: {
        results: caseResults,
        amrRows: pick(bySampleResult.amrRows, resultIds),
        astRows: pick(bySampleResult.astRows, resultIds),
        communications: pick(bySampleResult.communications, resultIds),
      },
      therapies: caseTherapies,
      therapyAdministrations: pick(administrationsByTherapy, caseTherapies.map(row => row.id)),
      isolations: forCase('isolations', caseRow.id),
      reassessments: forCase('reassessments', caseRow.id),
      outcomes: forCase('outcomes', caseRow.id),
      devices: forCase('devices', caseRow.id),
    })
  })
}

async function loadRelatedLab(related, sampleIds) {
  const empty = { results: [], amrRows: [], astRows: [], communications: [] }
  if (!sampleIds.length) return empty
  const microbiologyResult = await related('microbiology_results', '*', sampleIds, 'resulted_at', NEWEST, 'sample_id')
  if (microbiologyResult.error) throw microbiologyResult.error
  const results = microbiologyResult.data || []
  const resultIds = results.map(row => row.id)
  if (!resultIds.length) return { ...empty, results }
  const [amrResult, astResult, communicationResult] = await Promise.all([
    related('amr_classifications', AMR_SELECT, resultIds, 'classified_at', NEWEST_NULLS_LAST, 'microbiology_result_id'),
    related('antimicrobial_susceptibility_results', '*', resultIds, 'created_at', NEWEST, 'microbiology_result_id'),
    related('critical_result_communications', '*', resultIds, 'communicated_at', NEWEST, 'microbiology_result_id'),
  ])
  for (const result of [amrResult, astResult, communicationResult]) if (result.error) throw result.error
  return {
    results,
    amrRows: amrResult.data || [],
    astRows: astResult.data || [],
    communications: communicationResult.data || [],
  }
}

// A line of the Surveillance list from surveillance_case_summaries
// (20261201110000): the episode with its patient, department and isolation,
// and only the samples that name an organism or a resistance (all the list reads).
function mapCaseSummary(row) {
  const isolations = row.isolation ? [{ ...row.isolation, surveillance_case_id: row.id }] : []
  return {
    ...mapClinicalCase({ caseRow: row, patient: row.patient, department: row.department, isolations }),
    samples: (row.samples || []).map(sample => ({
      id: sample.sample_code,
      recordId: sample.id,
      requestedAt: sample.requested_at,
      organism: sample.organism || null,
      resistance: sample.resistance || null,
      surveillanceCaseId: row.id,
      microbiologyResults: [],
    })),
  }
}

// Every case of the organization, read page by page (a single response is
// capped), then hydrated once so the related lists are read once too.
// `summary` (the list) reads one line per episode in a single call instead;
// the full read stays for a database without surveillance_case_summaries yet.
export async function loadClinicalCases(organizationId, { summary = false } = {}) {
  assertCloud()
  if (!organizationId) return []
  if (summary && typeof supabase.rpc === 'function') {
    const listed = await supabase.rpc('surveillance_case_summaries', { p_organization_id: organizationId })
    if (!listed?.error && Array.isArray(listed?.data)) return listed.data.map(mapCaseSummary)
  }
  const rows = await selectAllPages(() =>
    supabase
      .from('surveillance_cases')
      .select('*')
      .eq('organization_id', organizationId)
      .order('started_at', { ascending: false })
      .order('id', { ascending: true }),
  )
  return hydrateCases(rows)
}

export async function loadClinicalCase(organizationId, caseRecordId) {
  assertCloud()
  if (!organizationId || !UUID.test(String(caseRecordId || ''))) return null
  const { data, error } = await supabase
    .from('surveillance_cases')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', caseRecordId)
    .maybeSingle()
  if (error) throw error
  return data ? (await hydrateCases([data]))[0] : null
}

export async function loadClinicalCasesForPatient(organizationId, patientRecordId) {
  assertCloud()
  if (!organizationId || !patientRecordId) return []
  const { data, error } = await supabase
    .from('surveillance_cases')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('patient_id', patientRecordId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return hydrateCases(data || [])
}

export async function createClinicalCase(organizationId, patientRecordId, draft) {
  assertCloud()
  // One transaction in the database: the case, its admission link and the start event.
  const { data, error } = await supabase.rpc('create_surveillance_case', {
    p_organization_id: organizationId,
    p_patient_id: patientRecordId,
    p_department_id: draft.departmentId || null,
    p_started_at: iso(draft.startedAt || new Date()),
    p_review_due: dateOnly(draft.reviewDue),
    p_room: draft.room || null,
    p_reason: draft.reason || draft.reasonEn || null,
    p_reason_en: draft.reasonEn || draft.reason || null,
    p_suspected_source: draft.suspectedSource || null,
    p_admission_id: draft.admissionId || null,
  })
  if (error) throw error
  const caseRow = Array.isArray(data) ? data[0] : data
  return (await hydrateCases([caseRow]))[0]
}

// What a surveillance start records (or its later edit), as case columns.
function startColumns({ reviewDue, room, reason, reasonEn, suspectedSource }) {
  return {
    review_due_on: dateOnly(reviewDue),
    room: room || null,
    reason: reason || null,
    reason_en: reasonEn || null,
    suspected_source: suspectedSource || null,
  }
}

// One timeline event of a case and its short detail.
export async function saveClinicalEvent(
  organizationId,
  caseId,
  eventType,
  detail,
  { status = 'completed', occurredAt = null } = {},
) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_events')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: caseId,
      event_type: eventType,
      event_status: status,
      occurred_at: iso(occurredAt || new Date()),
      detail: detail || null,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// The team decided the patient needs no isolation: the decision on the case,
// and the event on its timeline.
export async function markIsolationNotRequired(organizationId, caseId) {
  assertCloud()
  const actorId = await currentUserId()
  const decidedAt = iso(new Date())
  const { error } = await supabase
    .from('surveillance_cases')
    .update({
      isolation_required: false,
      isolation_decided_at: decidedAt,
      isolation_decided_by: actorId,
    })
    .eq('organization_id', organizationId)
    .eq('id', caseId)
  if (error) throw error
  return saveClinicalEvent(organizationId, caseId, 'isolation_not_required', 'no', {
    occurredAt: decidedAt,
  })
}

// Rows of a list in their order, for a parent record.
async function insertListRows(table, rows) {
  if (!rows.length) return []
  const { data, error } = await supabase.from(table).insert(rows).select('*')
  if (error) throw error
  return data || []
}

export async function saveClinicalAssessment(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('clinical_assessments')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: record.recordId,
      patient_id: record.patientRecordId,
      department_id: record.departmentId || null,
      assessment_type: draft.assessmentType || 'suspected',
      classification: draft.classification || 'undetermined',
      summary: draft.summary || draft.notes || null,
      assessed_at: iso(draft.date || new Date()),
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const findingRow = kind => (label, index) => ({
    organization_id: organizationId,
    assessment_id: data.id,
    kind,
    position: index + 1,
    label,
    created_by: actorId,
  })
  const findings = await insertListRows('clinical_assessment_findings', [
    ...textList(draft.signsSymptoms).map(findingRow('sign')),
    ...textList(draft.riskFactors).map(findingRow('risk_factor')),
  ])
  return mapAssessment({ ...data, findings })
}

export async function saveHaiClassification(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('hai_classifications')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: record.recordId,
      patient_id: record.patientRecordId,
      case_status: draft.status || 'suspected',
      hai_type: draft.type,
      definition_set: draft.definitionSet || 'local',
      definition_version: draft.definitionVersion || null,
      criteria_met: draft.criteriaMet ?? null,
      rationale: draft.rationale || null,
      classified_at: iso(draft.classifiedAt || new Date()),
      classified_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const criteria = await insertListRows(
    'hai_classification_criteria',
    textList(draft.criteriaEvidence).map((criterionId, index) => ({
      organization_id: organizationId,
      hai_classification_id: data.id,
      position: index + 1,
      criterion_id: criterionId,
      created_by: actorId,
    })),
  )
  return mapHai({ ...data, criteria })
}

function sampleCode() {
  const stamp = new Date().toISOString().slice(2, 10).replaceAll('-', '')
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `LAB-${stamp}-${suffix}`
}

export async function requestLaboratorySample(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('laboratory_samples')
    .insert({
      organization_id: organizationId,
      patient_id: record.patientRecordId,
      surveillance_case_id: record.recordId,
      department_id: record.departmentId || null,
      sample_code: sampleCode(),
      sample_type: draft.type,
      source_site: draft.source || null,
      collected_at: null,
      received_at: null,
      status: 'requested',
      requested_at: iso(new Date()),
      requested_by: actorId,
      priority: draft.priority || 'routine',
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapSample(data)
}

export async function startIsolation(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('isolation_episodes')
    .insert({
      organization_id: organizationId,
      patient_id: record.patientRecordId,
      surveillance_case_id: record.recordId,
      department_id: record.departmentId || null,
      room: draft.room || null,
      reason: draft.reason,
      started_at: iso(draft.startedAt || new Date()),
      review_due_at: iso(draft.reviewDue),
      status: 'active',
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const precautionRows = await insertListRows(
    'isolation_episode_precautions',
    textList(draft.precautions).map((precaution, index) => ({
      organization_id: organizationId,
      isolation_episode_id: data.id,
      position: index + 1,
      precaution,
      created_by: actorId,
    })),
  )
  return mapIsolation({ ...data, precaution_rows: precautionRows })
}

export async function endIsolation(organizationId, isolationId, draft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('isolation_episodes')
    .update({
      status: draft.status || 'ended',
      ended_at: iso(draft.endedAt || new Date()),
      end_reason: draft.reason || null,
      ended_by: actorId,
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId)
    .eq('id', isolationId)
    .select(ISOLATION_SELECT)
    .single()
  if (error) throw error
  return mapIsolation(data)
}

export async function addAntimicrobialTherapy(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const approvalStatus = draft.isAdvancedAntibiotic
    ? 'pending'
    : draft.approvalStatus || 'not_required'
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .insert({
      organization_id: organizationId,
      patient_id: record.patientRecordId,
      surveillance_case_id: record.recordId,
      antimicrobial: draft.antimicrobial,
      dose: draft.dose || null,
      route: draft.route || null,
      indication: draft.indication || null,
      started_at: iso(draft.startedAt || new Date()),
      planned_end_at: iso(draft.plannedEndAt),
      approval_status: approvalStatus,
      status: 'active',
      therapy_plan_id: draft.therapyPlanId || crypto.randomUUID(),
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function endAntimicrobialTherapy(organizationId, therapyId, draft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .update({
      status: draft.status || 'completed',
      ended_at: iso(draft.endedAt || new Date()),
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId)
    .eq('id', therapyId)
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function setTherapyApproval(organizationId, therapyId, approvalStatus) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .update({ approval_status: approvalStatus, updated_by: actorId, updated_at: iso(new Date()) })
    .eq('organization_id', organizationId)
    .eq('id', therapyId)
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function recordTherapyAdministration(organizationId, therapyId, draft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapy_administrations')
    .insert({
      organization_id: organizationId,
      therapy_id: therapyId,
      administered_at: iso(draft.administeredAt || new Date()),
      dose: draft.dose || null,
      route: draft.route || null,
      status: draft.status || 'administered',
      withheld_reason: draft.withheldReason || null,
      administered_by: actorId,
      notes: draft.notes || null,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapAdministration(data)
}

export async function addSurveillanceDevice(organizationId, record, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_devices')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: record.recordId,
      patient_id: record.patientRecordId,
      department_id: record.departmentId || null,
      device_type: draft.type,
      site: draft.site || null,
      indication: draft.indication || null,
      inserted_at: iso(draft.insertedAt || new Date()),
      review_due_at: iso(draft.reviewDue),
      status: 'active',
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapDevice(data)
}

export async function removeSurveillanceDevice(organizationId, deviceId, draft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_devices')
    .update({
      status: 'removed',
      removed_at: iso(draft.removedAt || new Date()),
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId)
    .eq('id', deviceId)
    .select('*')
    .single()
  if (error) throw error
  return mapDevice(data)
}

export async function addClinicalReassessment(
  organizationId,
  caseRecordId,
  patientRecordId,
  draft,
) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_reassessments')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: caseRecordId,
      patient_id: patientRecordId,
      clinical_status: reassessmentStatusDbValue(draft.status),
      isolation_decision: reassessmentDecisionDbValue(draft.isolationDecision, [
        'continue',
        'modify',
        'discontinue',
        'not_applicable',
      ]),
      therapy_decision: reassessmentDecisionDbValue(draft.therapyDecision || draft.decision),
      notes: draft.notes || null,
      reassessed_at: iso(draft.date || new Date()),
      next_review_due_at: iso(draft.nextReviewDue),
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapReassessment(data)
}

export async function completeClinicalCase(organizationId, caseRecordId, patientRecordId, draft) {
  assertCloud()
  const actorId = await currentUserId()
  const occurredAt = iso(draft.date || new Date())
  const { data: outcome, error: outcomeError } = await supabase
    .from('surveillance_outcomes')
    .insert({
      organization_id: organizationId,
      surveillance_case_id: caseRecordId,
      patient_id: patientRecordId,
      outcome: draft.status,
      occurred_at: occurredAt,
      notes: draft.notes || null,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (outcomeError) throw outcomeError
  const { error: caseError } = await supabase
    .from('surveillance_cases')
    .update({
      status: 'closed',
      closed_at: occurredAt,
      close_reason: draft.notes || draft.status || null,
      closed_by: actorId,
    })
    .eq('organization_id', organizationId)
    .eq('id', caseRecordId)
  if (caseError) throw caseError
  return mapOutcome(outcome)
}

export async function updateClinicalCaseBasics(organizationId, record, draft) {
  assertCloud()
  const startedAt = iso(draft.startedAt || record.startedAt || new Date())
  const { data: caseRow, error } = await supabase
    .from('surveillance_cases')
    .update({
      started_at: startedAt,
      department_id: draft.departmentId || record.departmentId || null,
      ...startColumns({
        reviewDue: draft.reviewDue ?? record.reviewDue ?? null,
        room: draft.room ?? record.room ?? '',
        reason: draft.reason ?? record.reason ?? '',
        reasonEn: draft.reasonEn ?? draft.reason ?? record.reasonEn ?? record.reason ?? '',
        suspectedSource: draft.suspectedSource ?? record.suspectedSource ?? '',
      }),
    })
    .eq('organization_id', organizationId)
    .eq('id', record.recordId)
    .select('*')
    .single()
  if (error) throw error
  await saveClinicalEvent(organizationId, record.recordId, 'surveillance_start', 'updated', {
    occurredAt: startedAt,
  })
  return (await hydrateCases([caseRow]))[0]
}

export async function voidClinicalCase(organizationId, caseRecordId, reason) {
  assertCloud()
  const { error } = await supabase
    .from('surveillance_cases')
    .update({ status: 'cancelled', void_reason: reason })
    .eq('organization_id', organizationId)
    .eq('id', caseRecordId)
  if (error) throw error
}

export async function reopenClinicalCase(organizationId, caseRecordId, reason) {
  assertCloud()
  const { error } = await supabase
    .from('surveillance_cases')
    .update({ status: 'active', reopen_reason: reason })
    .eq('organization_id', organizationId)
    .eq('id', caseRecordId)
  if (error) throw error
}
