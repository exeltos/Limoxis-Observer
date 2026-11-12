import { supabase, type Cloud } from '../../core/supabase/client'
import { assertCloud } from '../../core/supabase/cloudContext'
import type { AnyRecord } from '../../types/featureTypes'
import { clinicalCases } from '../surveillance/clinicalDemoData'

// A patient's infection-prevention flags.
export interface InfectionFlags {
  resistance: { classification: string, organism: string, since: string | null } | null
  isolation: { since: string | null, precautions: string[] } | null
}

const caseDate = (row: AnyRecord | null | undefined) => String(row?.startedAt || row?.admissionDate || '')

// Infection-prevention flags per patient, derived from surveillance episodes:
// - resistance: the most recent resistance classification (MDR, XDR, ESBL,
//   MRSA …) from any non-cancelled episode. Carriage matters on readmission,
//   so a closed episode still flags the patient.
// - isolation: an isolation that is currently in place.
// Keyed by the patient's cloud record id, or by the patient code in the demo.
export function infectionFlagsFromCases(cases: readonly AnyRecord[] = []): Record<string, InfectionFlags> {
  const out: Record<string, InfectionFlags> = {}
  const sorted = [...cases].filter(row => row && row.status !== 'cancelled').sort((a, b) => caseDate(b).localeCompare(caseDate(a)))
  for (const row of sorted) {
    const key = row.patientRecordId || row.patientId
    if (!key) continue
    const flags: InfectionFlags = out[key] ??= { resistance: null, isolation: null }
    const resistance = row.resistance || row.samples?.find((sample: AnyRecord | null) => sample?.resistance)?.resistance || null
    if (!flags.resistance && resistance) {
      flags.resistance = { classification: resistance, organism: row.organism || row.samples?.find((sample: AnyRecord | null) => sample?.organism)?.organism || '', since: row.startedAt || null }
    }
    if (!flags.isolation && row.isolation?.status === 'active') {
      flags.isolation = { since: row.isolation.startedAt || row.startedAt || null, precautions: row.isolation.precautions || [] }
    }
  }
  return out
}

export async function loadPatientInfectionFlags(organizationId: string | null | undefined, { isDemo = false } = {}): Promise<Record<string, InfectionFlags>> {
  if (isDemo) return infectionFlagsFromCases(Object.values(clinicalCases) as AnyRecord[])
  if (!organizationId) return {}
  // One row per resistant or isolated patient from the database (patient_infection_flags,
  // 20261128500000), the rules above, instead of hydrating every episode.
  // Active isolation from the same read (20261129200000).
  assertCloud()
  // assertCloud() has checked that the client is configured.
  const { data, error } = await (supabase as Cloud).rpc('patient_infection_flags', { p_organization_id: organizationId })
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.patient_id, {
    resistance: row.classification ? { classification: row.classification, organism: row.organism || '', since: row.since || null } : null,
    isolation: row.isolated ? { since: row.isolation_since || null, precautions: row.isolation_precautions || [] } : null,
  }]))
}
