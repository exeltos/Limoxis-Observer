import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import type { Database } from '../../core/supabase/database.types'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'
import {
  dateOnly,
  iso,
  mapAssessment,
  mapHai,
  mapOutcome,
  mapReassessment,
  mapSample,
  reassessmentDecisionDbValue,
  reassessmentStatusDbValue,
  textList,
} from './clinicalCloudMappers'
import type {
  AssessmentDraft,
  ClinicalCase,
  ClinicalCaseDraft,
  HaiDraft,
  OutcomeDraft,
  ReassessmentDraft,
  SampleRequestDraft,
} from './clinicalTypes'

import { hydrateCases } from './clinicalCaseReads'
import { insertListRows } from './clinicalCareCloudService'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud
// A cloud record always carries its row ids (mapClinicalCase sets recordId and patientRecordId), but the
// record type keeps them optional (demo records have none): `as string` names them as the columns take them.
export async function createClinicalCase(organizationId: string | null | undefined, patientRecordId: string | undefined, draft: ClinicalCaseDraft) {
  assertCloud()
  // One transaction in the database: the case, its admission link and the start event.
  const { data, error } = await supabase.rpc('create_surveillance_case', {
    p_organization_id: organizationId as string,
    p_patient_id: patientRecordId,
    p_department_id: draft.departmentId || null,
    p_started_at: iso(draft.startedAt || new Date())!,
    p_review_due: dateOnly(draft.reviewDue) as string,
    p_room: draft.room || null,
    p_reason: draft.reason || draft.reasonEn || null,
    p_reason_en: draft.reasonEn || draft.reason || null,
    p_suspected_source: draft.suspectedSource || null,
    p_admission_id: draft.admissionId || null,
    // The function takes null for an unset value (the generated Args leave null out).
  } as Database['public']['Functions']['create_surveillance_case']['Args'])
  if (error) throw error
  const caseRow = Array.isArray(data) ? data[0] : data
  return (await hydrateCases([caseRow]))[0]
}

interface StartColumnsOptions {
  reviewDue?: string | null
  room?: string | null
  reason?: string | null
  reasonEn?: string | null
  suspectedSource?: string | null
}
// What a surveillance start records (or its later edit), as case columns.
function startColumns({ reviewDue, room, reason, reasonEn, suspectedSource }: StartColumnsOptions) {
  return {
    review_due_on: dateOnly(reviewDue),
    room: room || null,
    reason: reason || null,
    reason_en: reasonEn || null,
    suspected_source: suspectedSource || null,
  }
}

interface SaveClinicalEventOptions {
  status?: string
  occurredAt?: string | null
}
// One timeline event of a case and its short detail.
export async function saveClinicalEvent(
  organizationId: string | null | undefined,
  caseId: string,
  eventType: string,
  detail: string,
  { status = 'completed', occurredAt = null }: SaveClinicalEventOptions = {},
) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_events')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: caseId,
      event_type: eventType,
      event_status: status,
      occurred_at: iso(occurredAt || new Date())!,
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
export async function markIsolationNotRequired(organizationId: string | null | undefined, caseId: string | undefined) {
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
    .eq('organization_id', organizationId as string)
    .eq('id', caseId as string)
  if (error) throw error
  return saveClinicalEvent(organizationId, caseId as string, 'isolation_not_required', 'no', {
    occurredAt: decidedAt,
  })
}

export async function saveClinicalAssessment(organizationId: string | null | undefined, record: ClinicalCase, draft: AssessmentDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('clinical_assessments')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: record.recordId as string,
      patient_id: record.patientRecordId as string,
      department_id: record.departmentId || null,
      assessment_type: draft.assessmentType || 'suspected',
      classification: draft.classification || 'undetermined',
      summary: draft.summary || draft.notes || null,
      assessed_at: iso(draft.date || new Date())!,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const findingRow = (kind: string) => (label: string, index: number) => ({
    organization_id: organizationId as string,
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

export async function saveHaiClassification(organizationId: string | null | undefined, record: ClinicalCase, draft: HaiDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('hai_classifications')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: record.recordId as string,
      patient_id: record.patientRecordId as string,
      case_status: draft.status || 'suspected',
      hai_type: draft.type,
      definition_set: draft.definitionSet || 'local',
      definition_version: draft.definitionVersion || null,
      criteria_met: draft.criteriaMet ?? null,
      rationale: draft.rationale || null,
      classified_at: iso(draft.classifiedAt || new Date())!,
      classified_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const criteria = await insertListRows(
    'hai_classification_criteria',
    textList(draft.criteriaEvidence).map((criterionId, index) => ({
      organization_id: organizationId as string,
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

export async function requestLaboratorySample(organizationId: string | null | undefined, record: ClinicalCase, draft: SampleRequestDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('laboratory_samples')
    .insert({
      organization_id: organizationId as string,
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

export async function addClinicalReassessment(
  organizationId: string | null | undefined,
  caseRecordId: string | undefined,
  patientRecordId: string | undefined,
  draft: ReassessmentDraft,
) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_reassessments')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: caseRecordId as string,
      patient_id: patientRecordId as string,
      clinical_status: reassessmentStatusDbValue(draft.status),
      isolation_decision: reassessmentDecisionDbValue(draft.isolationDecision, [
        'continue',
        'modify',
        'discontinue',
        'not_applicable',
      ]),
      therapy_decision: reassessmentDecisionDbValue(draft.therapyDecision || draft.decision),
      notes: draft.notes || null,
      reassessed_at: iso(draft.date || new Date())!,
      next_review_due_at: iso(draft.nextReviewDue),
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapReassessment(data)
}

export async function completeClinicalCase(organizationId: string | null | undefined, caseRecordId: string | undefined, patientRecordId: string | undefined, draft: OutcomeDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const occurredAt = iso(draft.date || new Date())!
  const { data: outcome, error: outcomeError } = await supabase
    .from('surveillance_outcomes')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: caseRecordId as string,
      patient_id: patientRecordId as string,
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
    .eq('organization_id', organizationId as string)
    .eq('id', caseRecordId as string)
  if (caseError) throw caseError
  return mapOutcome(outcome)
}

export async function updateClinicalCaseBasics(organizationId: string | null | undefined, record: ClinicalCase, draft: ClinicalCaseDraft) {
  assertCloud()
  const startedAt = iso(draft.startedAt || record.startedAt || new Date())!
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
    .eq('organization_id', organizationId as string)
    .eq('id', record.recordId as string)
    .select('*')
    .single()
  if (error) throw error
  await saveClinicalEvent(organizationId, record.recordId as string, 'surveillance_start', 'updated', {
    occurredAt: startedAt,
  })
  return (await hydrateCases([caseRow]))[0]
}

export async function voidClinicalCase(organizationId: string | null | undefined, caseRecordId: string | undefined, reason: string) {
  assertCloud()
  const { error } = await supabase
    .from('surveillance_cases')
    .update({ status: 'cancelled', void_reason: reason })
    .eq('organization_id', organizationId as string)
    .eq('id', caseRecordId as string)
  if (error) throw error
}

export async function reopenClinicalCase(organizationId: string | null | undefined, caseRecordId: string | undefined, reason: string) {
  assertCloud()
  const { error } = await supabase
    .from('surveillance_cases')
    .update({ status: 'active', reopen_reason: reason })
    .eq('organization_id', organizationId as string)
    .eq('id', caseRecordId as string)
  if (error) throw error
}
