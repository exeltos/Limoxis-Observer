import { groupByColumn, selectAllPages, selectInChunks } from '../../core/data/inChunks'
import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertCloud } from '../../core/supabase/cloudContext'
import {
  AMR_SELECT,
  ASSESSMENT_SELECT,
  HAI_SELECT,
  ISOLATION_SELECT,
  UUID,
  mapClinicalCase,
  mapHai,
} from './clinicalCloudMappers'
import type {
  AdministrationRow,
  AssessmentRow,
  CaseSummaryRow,
  CaseSummarySampleRow,
  ClinicalCase,
  ClinicalCaseRow,
  DeviceRow,
  HaiRow,
  IsolationRow,
  MicrobiologyResultRow,
  OutcomeRow,
  ReassessmentRow,
  RelatedLabRows,
  SampleRow,
  SurveillanceEventRow,
  TherapyRow,
} from './clinicalTypes'


// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud
// A cloud record always carries its row ids (mapClinicalCase sets recordId and patientRecordId), but the
// record type keeps them optional (demo records have none): `as string` names them as the columns take them.
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

export async function hydrateCases(caseRows: ClinicalCaseRow[]) {
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

