import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migrationFull = fs.readFileSync('supabase/migrations/20260919270000_fix_indicator_snapshot_jsonb_build_object_arg_limit.sql', 'utf8')
// Strip comment lines so the sample calls mentioned in the header comment
// (e.g. "jsonb_build_object(...)") aren't picked up as real SQL.
const migration = migrationFull.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

// Split a jsonb_build_object(...) call body on its top-level commas (there are
// no nested parentheses in these calls — every argument is a scalar literal
// or a plpgsql variable name).
function topLevelArgCount(body) {
  return body.split(',').length
}

describe('indicator_metric_snapshot jsonb_build_object PostgreSQL argument limit (PG hard-caps any function call at 100 args)', () => {
  it('never lets a single jsonb_build_object(...) call exceed the 100-argument limit', () => {
    const calls = [...migration.matchAll(/jsonb_build_object\(([^)]*)\)/g)].map(match => match[1])
    expect(calls.length).toBeGreaterThan(0)
    for (const body of calls) {
      const argCount = topLevelArgCount(body)
      expect(argCount).toBeLessThanOrEqual(100)
      // Must also be even (key,value pairs) or jsonb_build_object itself would reject it.
      expect(argCount % 2).toBe(0)
    }
  })

  it('splits the metric snapshot into multiple concatenated jsonb_build_object calls rather than one', () => {
    const callCount = (migration.match(/jsonb_build_object\(/g) || []).length
    expect(callCount).toBeGreaterThan(1)
    expect(migration).toContain('||')
  })

  it('still returns every metric key the previous single-call version returned', () => {
    const expectedKeys = [
      'patient_days', 'active_surveillance', 'resistant_active_surveillance', 'hh_compliant_actions', 'hh_opportunities',
      'bundle_all_or_none_pass', 'bundle_executions', 'abhr_litres', 'active_staff', 'active_staff_with_vaccination',
      'training_completed', 'training_assignments', 'open_high_incidents', 'mdro_bsi',
      'bacteremia_total', 'bacteremia_ecoli', 'bacteremia_proteus', 'bacteremia_acinetobacter', 'bacteremia_klebsiella',
      'bacteremia_enterobacter', 'bacteremia_pseudomonas', 'bacteremia_saureus', 'bacteremia_enterococcus',
      'amr_tested_ecoli', 'amr_resistant_ecoli', 'amr_tested_proteus', 'amr_resistant_proteus',
      'amr_tested_acinetobacter', 'amr_resistant_acinetobacter', 'amr_tested_klebsiella', 'amr_resistant_klebsiella',
      'amr_tested_enterobacter', 'amr_resistant_enterobacter', 'amr_tested_pseudomonas', 'amr_resistant_pseudomonas',
      'amr_tested_saureus', 'amr_resistant_saureus', 'amr_tested_enterococcus', 'amr_resistant_enterococcus',
      'antibiotic_ddd_total',
      'mdr_isolation_total', 'mdr_isolation_ecoli', 'mdr_isolation_proteus', 'mdr_isolation_acinetobacter',
      'mdr_isolation_klebsiella', 'mdr_isolation_enterobacter', 'mdr_isolation_pseudomonas', 'mdr_isolation_saureus',
      'mdr_isolation_enterococcus',
      'pps_patients_total', 'pps_patients_with_hai', 'pps_patients_on_antibiotics',
    ]
    expect(expectedKeys.length).toBe(52)
    for (const key of expectedKeys) expect(migration).toContain(`'${key}'`)
  })
})
