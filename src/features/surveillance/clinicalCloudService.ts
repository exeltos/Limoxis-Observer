import { groupByColumn, selectAllPages, selectInChunks } from '../../core/data/inChunks'
import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../core/supabase/database.types'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'
import {
  AMR_SELECT,
  ASSESSMENT_SELECT,
  HAI_SELECT,
  ISOLATION_SELECT,
  UUID,
  dateOnly,
  iso,
  mapAssessment,
  mapClinicalCase,
  mapHai,
  mapOutcome,
  mapReassessment,
  mapSample,
  reassessmentDecisionDbValue,
  reassessmentStatusDbValue,
  reassessmentStatusUiValue,
  textList,
} from './clinicalCloudMappers'
import type {
  AdministrationRow,
  AssessmentDraft,
  AssessmentRow,
  CaseSummaryRow,
  CaseSummarySampleRow,
  ClinicalCase,
  ClinicalCaseDraft,
  ClinicalCaseRow,
  DeviceRow,
  HaiDraft,
  HaiRow,
  IsolationRow,
  MicrobiologyResultRow,
  OutcomeDraft,
  OutcomeRow,
  ReassessmentDraft,
  ReassessmentRow,
  RelatedLabRows,
  SampleRequestDraft,
  SampleRow,
  SurveillanceEventRow,
  TherapyRow,
} from './clinicalTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud
// A cloud record always carries its row ids (mapClinicalCase sets recordId and patientRecordId), but the
// record type keeps them optional (demo records have none): `as string` names them as the columns take them.

export { reassessmentStatusDbValue, reassessmentStatusUiValue, reassessmentDecisionDbValue }
import { insertListRows } from './clinicalCareCloudService'
export { startIsolation, endIsolation, addAntimicrobialTherapy, endAntimicrobialTherapy, setTherapyApproval, recordTherapyAdministration, addSurveillanceDevice, removeSurveillanceDevice } from './clinicalCareCloudService'

// The names of the people who recorded the entries of a case (best effort: an id that
// cannot be resolved is simply not shown).
export async function loadActorNames(organizationId: string | null | undefined, userIds: (string | null | undefined)[] = []): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean).map(String))].slice(0, 200)
  if (!organizationId || !ids.length) return new Map()
  const { data, error } = await supabase.rpc('organization_member_names', { p_organization_id: organizationId as string, p_user_ids: ids })
  if (error) throw error
  return new Map((data || []).map(row => [String(row.user_id), row.full_name]))
}

// Rows of `table` whose `column` is one of `ids`, newest first by `orderColumn`.
// Many ids are read as the organization's whole list (see selectInChunks).
type OrderOptions = { ascending: boolean, nullsFirst?: boolean }
function relatedRows(organizationId: string | null | undefined, table: string, select: string, column: string, ids: unknown[], orderColumn: string, orderOptions: OrderOptions) {
  // The table and its columns are chosen at run time (no row types for them).
  const supabase = configuredClient as unknown as SupabaseClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a query of a table chosen at run time
  const ordered = (query: any) => query.order(orderColumn, orderOptions).order('id', { ascending: true })
  return selectInChunks(ids, chunk => ordered(supabase.from(table).select(select).in(column, chunk)), {
    order: [[orderColumn, orderOptions]],
    column,
    whole: organizationId
      ? () => ordered(supabase.from(table).select(select).eq('organization_id', organizationId as string))
      : undefined,
  })
}

type Related = (table: string, select: string, ids: unknown[], orderColumn: string, orderOptions: OrderOptions, column?: string) => ReturnType<typeof relatedRows>
// The rows of each table, grouped by the key they hang from.
type RowGroups<T> = { [K in keyof T]: Map<unknown, T[K]> }
// The rows of an episode's lists, by list.
interface CaseRows {
  events: SurveillanceEventRow[]
  assessments: AssessmentRow[]
  hai: HaiRow[]
  samples: SampleRow[]
  therapies: TherapyRow[]
  isolations: IsolationRow[]
  reassessments: ReassessmentRow[]
  outcomes: OutcomeRow[]
  devices: DeviceRow[]
}
const NEWEST = { ascending: false }
const NEWEST_NULLS_LAST = { ascending: false, nullsFirst: false }

async function hydrateCases(caseRows: ClinicalCaseRow[]) {
  if (!caseRows?.length) return []
  const organizationId = caseRows[0].organization_id
  const caseIds = caseRows.map((row: ClinicalCaseRow) => row.id)
  const patientIds = [...new Set(caseRows.map((row: ClinicalCaseRow) => row.patient_id))]
  const departmentIds = [...new Set(caseRows.map((row: ClinicalCaseRow) => row.department_id).filter(Boolean))]
  const related: Related = (table, select, ids, orderColumn, orderOptions, column = 'surveillance_case_id') =>
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
  const bySampleResult: RowGroups<Required<Omit<RelatedLabRows, 'results'>>> = {
    amrRows: groupByColumn(labResults.amrRows, 'microbiology_result_id'),
    astRows: groupByColumn(labResults.astRows, 'microbiology_result_id'),
    communications: groupByColumn(labResults.communications, 'microbiology_result_id'),
  }
  const resultsBySample: Map<unknown, MicrobiologyResultRow[]> = groupByColumn(labResults.results, 'sample_id')
  const administrationsByTherapy: Map<unknown, AdministrationRow[]> = groupByColumn(administrationsResult.data, 'therapy_id')
  const patients = new Map((patientsResult.data || []).map(row => [row.id, row]))
  const departments = new Map((departmentsResult.data || []).map(row => [row.id, row]))
  const byCase = (rows: unknown[] | null) => groupByColumn(rows, 'surveillance_case_id')
  const grouped: RowGroups<CaseRows> = {
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
  const forCase = <K extends keyof CaseRows>(key: K, caseId: string): CaseRows[K] => grouped[key].get(caseId) || []
  const pick = <T>(groups: Map<unknown, T[]>, ids: string[]) => ids.flatMap((id: string) => groups.get(id) || [])

  return caseRows.map((caseRow: ClinicalCaseRow) => {
    const caseSamples = forCase('samples', caseRow.id)
    const caseResults = pick(resultsBySample, caseSamples.map((row: SampleRow) => row.id))
    const resultIds = caseResults.map((row: MicrobiologyResultRow) => row.id)
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
      therapyAdministrations: pick(administrationsByTherapy, caseTherapies.map((row: TherapyRow) => row.id)),
      isolations: forCase('isolations', caseRow.id),
      reassessments: forCase('reassessments', caseRow.id),
      outcomes: forCase('outcomes', caseRow.id),
      devices: forCase('devices', caseRow.id),
    })
  })
}

async function loadRelatedLab(related: Related, sampleIds: unknown[]): Promise<Required<RelatedLabRows>> {
  const empty: Required<RelatedLabRows> = { results: [], amrRows: [], astRows: [], communications: [] }
  if (!sampleIds.length) return empty
  const microbiologyResult = await related('microbiology_results', '*', sampleIds, 'resulted_at', NEWEST, 'sample_id')
  if (microbiologyResult.error) throw microbiologyResult.error
  const results = microbiologyResult.data || []
  const resultIds = results.map((row: MicrobiologyResultRow) => row.id)
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
function mapCaseSummary(row: CaseSummaryRow): ClinicalCase {
  const isolations = row.isolation ? [{ ...row.isolation, surveillance_case_id: row.id }] : []
  return {
    ...mapClinicalCase({ caseRow: row, patient: row.patient, department: row.department, isolations }),
    sampleCount: Number(row.patient_sample_count ?? 0),
    // How many samples the surveillance itself holds (a surveillance without any is not listed, owner 8/11/2026).
    caseSampleCount: row.case_sample_count == null ? null : Number(row.case_sample_count),
    samples: (row.samples || []).map((sample: CaseSummarySampleRow) => ({
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

interface LoadClinicalCasesOptions {
  summary?: boolean
}
// Every case of the organization, read page by page (a single response is
// capped), then hydrated once so the related lists are read once too.
// `summary` (the list) reads one line per episode in a single call instead;
// the full read stays for a database without surveillance_case_summaries yet.
export async function loadClinicalCases(organizationId: string | null | undefined, { summary = false }: LoadClinicalCasesOptions = {}) {
  assertCloud()
  if (!organizationId) return []
  if (summary && typeof supabase.rpc === 'function') {
    const listed = await supabase.rpc('surveillance_case_summaries', { p_organization_id: organizationId as string })
    if (!listed?.error && Array.isArray(listed?.data)) return listed.data.map(row => mapCaseSummary(row as CaseSummaryRow))
  }
  const rows = await selectAllPages(() =>
    supabase
      .from('surveillance_cases')
      .select('*')
      .eq('organization_id', organizationId as string)
      .order('started_at', { ascending: false })
      .order('id', { ascending: true }),
  )
  return hydrateCases(rows)
}

// The latest HAI classification of each episode (by its record id), for the «Αναφορά λοιμώξεων» of the list
// (owner, 19/11/2026): the list reads summaries, which do not carry the classification.
export async function loadHaiClassificationsByCase(organizationId: string | null | undefined, caseRecordIds: string[]): Promise<Map<string, ReturnType<typeof mapHai>>> {
  assertCloud()
  const byCase = new Map<string, ReturnType<typeof mapHai>>()
  if (!organizationId || !caseRecordIds.length) return byCase
  const result = await relatedRows(organizationId, 'hai_classifications', HAI_SELECT, 'surveillance_case_id', caseRecordIds, 'classified_at', NEWEST)
  if (result.error) throw result.error
  for (const row of (result.data || []) as HaiRow[]) if (!byCase.has(String(row.surveillance_case_id))) byCase.set(String(row.surveillance_case_id), mapHai(row))
  return byCase
}

export async function loadClinicalCase(organizationId: string | null | undefined, caseRecordId: string) {
  assertCloud()
  if (!organizationId || !UUID.test(String(caseRecordId || ''))) return null
  const { data, error } = await supabase
    .from('surveillance_cases')
    .select('*')
    .eq('organization_id', organizationId as string)
    .eq('id', caseRecordId)
    .maybeSingle()
  if (error) throw error
  return data ? (await hydrateCases([data]))[0] : null
}

export async function loadClinicalCasesForPatient(organizationId: string | null | undefined, patientRecordId: string) {
  assertCloud()
  if (!organizationId || !patientRecordId) return []
  const { data, error } = await supabase
    .from('surveillance_cases')
    .select('*')
    .eq('organization_id', organizationId as string)
    .eq('patient_id', patientRecordId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return hydrateCases(data || [])
}

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
