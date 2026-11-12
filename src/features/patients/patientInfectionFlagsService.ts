import { supabase } from '../../core/supabase/client'
import { assertCloud } from '../../core/supabase/cloudContext'
import { clinicalCases } from '../surveillance/clinicalDemoData'

const caseDate = row => String(row?.startedAt || row?.admissionDate || '')

// Infection-prevention flags per patient, derived from surveillance episodes:
// - resistance: the most recent resistance classification (MDR, XDR, ESBL,
//   MRSA …) from any non-cancelled episode. Carriage matters on readmission,
//   so a closed episode still flags the patient.
// - isolation: an isolation that is currently in place.
// Keyed by the patient's cloud record id, or by the patient code in the demo.
export function infectionFlagsFromCases(cases = []) {
  const out = {}
  const sorted = [...cases].filter(row => row && row.status !== 'cancelled').sort((a, b) => caseDate(b).localeCompare(caseDate(a)))
  for (const row of sorted) {
    const key = row.patientRecordId || row.patientId
    if (!key) continue
    const flags = out[key] ??= { resistance: null, isolation: null }
    const resistance = row.resistance || row.samples?.find(sample => sample?.resistance)?.resistance || null
    if (!flags.resistance && resistance) {
      flags.resistance = { classification: resistance, organism: row.organism || row.samples?.find(sample => sample?.organism)?.organism || '', since: row.startedAt || null }
    }
    if (!flags.isolation && row.isolation?.status === 'active') {
      flags.isolation = { since: row.isolation.startedAt || row.startedAt || null, precautions: row.isolation.precautions || [] }
    }
  }
  return out
}

export async function loadPatientInfectionFlags(organizationId, { isDemo = false } = {}) {
  if (isDemo) return infectionFlagsFromCases(Object.values(clinicalCases))
  if (!organizationId) return {}
  // One row per resistant or isolated patient from the database (patient_infection_flags,
  // 20261128500000), the rules above, instead of hydrating every episode.
  // Active isolation from the same read (20261129200000).
  assertCloud()
  const { data, error } = await supabase.rpc('patient_infection_flags', { p_organization_id: organizationId })
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.patient_id, {
    resistance: row.classification ? { classification: row.classification, organism: row.organism || '', since: row.since || null } : null,
    isolation: row.isolated ? { since: row.isolation_since || null, precautions: row.isolation_precautions || [] } : null,
  }]))
}
