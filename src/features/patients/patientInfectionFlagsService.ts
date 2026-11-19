import { supabase, type Cloud } from '../../core/supabase/client'
import { assertCloud } from '../../core/supabase/cloudContext'
import { clinicalCases } from '../surveillance/clinicalDemoData'

// What the flags read of a surveillance episode (the surveillance module is not typed yet).
type CaseLike = { status?: string, patientRecordId?: string, patientId?: string, resistance?: string, organism?: string, startedAt?: string | null, admissionDate?: string, samples?: ({ resistance?: string, organism?: string } | null)[], isolation?: { status?: string, startedAt?: string | null, precautions?: string[] } }

// A patient's infection-prevention flags.
export interface InfectionFlags {
  resistance: { classification: string, organism: string, since: string | null } | null
  isolation: { since: string | null, precautions: string[] } | null
  // The latest organism from a positive culture, resistant or not (owner, 19/11/2026).
  organism?: { name: string, since: string | null } | null
}

const caseDate = (row: CaseLike | null | undefined) => String(row?.startedAt || row?.admissionDate || '')

// Infection-prevention flags per patient, derived from surveillance episodes:
// - resistance: the most recent resistance classification (MDR, XDR, ESBL,
//   MRSA …) from any non-cancelled episode. Carriage matters on readmission,
//   so a closed episode still flags the patient.
// - isolation: an isolation that is currently in place.
// Keyed by the patient's cloud record id, or by the patient code in the demo.
export function infectionFlagsFromCases(cases: readonly CaseLike[] = []): Record<string, InfectionFlags> {
  const out: Record<string, InfectionFlags> = {}
  const sorted = [...cases].filter(row => row && row.status !== 'cancelled').sort((a, b) => caseDate(b).localeCompare(caseDate(a)))
  for (const row of sorted) {
    const key = row.patientRecordId || row.patientId
    if (!key) continue
    const flags: InfectionFlags = out[key] ??= { resistance: null, isolation: null, organism: null }
    const organism = row.organism || row.samples?.find((sample) => sample?.organism)?.organism || ''
    if (!flags.organism && organism) flags.organism = { name: organism, since: row.startedAt || null }
    const resistance = row.resistance || row.samples?.find((sample) => sample?.resistance)?.resistance || null
    if (!flags.resistance && resistance) {
      flags.resistance = { classification: resistance, organism: row.organism || row.samples?.find((sample) => sample?.organism)?.organism || '', since: row.startedAt || null }
    }
    if (!flags.isolation && row.isolation?.status === 'active') {
      flags.isolation = { since: row.isolation.startedAt || row.startedAt || null, precautions: row.isolation.precautions || [] }
    }
  }
  return out
}

export async function loadPatientInfectionFlags(organizationId: string | null | undefined, { isDemo = false } = {}): Promise<Record<string, InfectionFlags>> {
  if (isDemo) return infectionFlagsFromCases(Object.values(clinicalCases) as CaseLike[])
  if (!organizationId) return {}
  // One row per resistant or isolated patient from the database (patient_infection_flags,
  // 20261128500000), the rules above, instead of hydrating every episode.
  // Active isolation from the same read (20261129200000).
  assertCloud()
  // assertCloud() has checked that the client is configured.
  const [{ data, error }, organisms] = await Promise.all([
    (supabase as Cloud).rpc('patient_infection_flags', { p_organization_id: organizationId }),
    loadLatestOrganisms(organizationId),
  ])
  if (error) throw error
  const out: Record<string, InfectionFlags> = Object.fromEntries((data || []).map(row => [row.patient_id, {
    resistance: row.classification ? { classification: row.classification, organism: row.organism || '', since: row.since || null } : null,
    isolation: row.isolated ? { since: row.isolation_since || null, precautions: row.isolation_precautions || [] } : null,
    organism: null,
  }]))
  for (const row of organisms) {
    const flags = out[row.patient_id] ??= { resistance: null, isolation: null, organism: null }
    flags.organism = { name: row.organism, since: row.resulted_at || null }
    if (!flags.resistance && row.resistance) flags.resistance = { classification: row.resistance, organism: row.organism, since: row.resulted_at || null }
  }
  return out
}

// Every patient's latest organism (patient_latest_organisms, 20261231598000). Until that read exists in a database the
// list shows the flags as before: a missing function is no error here.
type LatestOrganismRow = { patient_id: string, organism: string, resistance: string | null, resulted_at: string | null }
// Read in pages of 1,000 (owner, 19/11/2026: a hospital with 1,195 patients lost the organism of those past the
// server's 1,000-row limit).
type LatestOrganismsResult = { data: LatestOrganismRow[] | null, error: unknown }
type LatestOrganismsQuery = PromiseLike<LatestOrganismsResult> & { range?: (from: number, to: number) => PromiseLike<LatestOrganismsResult> }
const ORGANISM_PAGE = 1000
async function loadLatestOrganisms(organizationId: string): Promise<LatestOrganismRow[]> {
  const rows: LatestOrganismRow[] = []
  for (let from = 0; from < 100 * ORGANISM_PAGE; from += ORGANISM_PAGE) {
    const query = (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => LatestOrganismsQuery }).rpc('patient_latest_organisms', { p_organization_id: organizationId })
    const paged = typeof query.range === 'function'
    const { data, error } = await (paged ? query.range!(from, from + ORGANISM_PAGE - 1) : query)
    if (error) return rows.filter(row => row?.patient_id && row.organism)
    rows.push(...(data || []))
    if (!paged || (data || []).length < ORGANISM_PAGE) break
  }
  return rows.filter(row => row?.patient_id && row.organism)
}
