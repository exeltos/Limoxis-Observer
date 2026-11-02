// Surveillance, Laboratory and the Surveys list read their lists in one call
// each (20261201110000); the patient record reads its own patient and samples.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261201110000_surveillance_laboratory_list_reads.sql')
const sql = migration.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

describe('list reads', () => {
  it('adds the three reads as SECURITY INVOKER functions', () => {
    for (const name of ['surveillance_case_summaries', 'laboratory_sample_list', 'quality_survey_response_counts']) {
      expect(sql).toContain(`create or replace function public.${name}(`)
      expect(sql).toContain(`grant execute on function public.${name}(`)
    }
    expect(sql.match(/security invoker/g)).toHaveLength(3)
    expect(sql).not.toContain('security definer')
  })

  it('keeps the full reads for a database without the functions', () => {
    const clinical = read('src/features/surveillance/clinicalCloudService.js')
    const laboratory = read('src/features/laboratory/laboratoryCloudService.js')
    const surveys = read('src/features/quality/surveys/surveyService.js')
    expect(clinical).toContain("supabase.rpc('surveillance_case_summaries'")
    expect(clinical).toContain('return hydrateCases(rows)')
    expect(laboratory).toContain("supabase.rpc('laboratory_sample_list'")
    expect(laboratory).toContain('return hydrateSamples(rows)')
    expect(surveys).toContain("supabase.rpc('quality_survey_response_counts'")
  })

  it('reads the patient record without the roster or the whole laboratory', () => {
    const record = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(record).toContain('loadPatientsByKeys(tenant.id, UUID_PATTERN.test(patientId) ? { recordIds: [patientId] } : { codes: [patientId] })')
    // The link from a surveillance row carries the record id: it opens the same patient.
    expect(record).toContain('isPatientKey(row, patientId)')
    expect(record).toContain('useLaboratoryRegistry({ enabled: isDemo || !tenant?.id || Boolean(labScope), scope: labScope })')
    expect(read('src/features/laboratory/repositories/supabaseLaboratoryRepository.js')).toContain('loadPatientLaboratorySamples(organizationId, scope)')
  })

  it('reads every committee attendance and decision row, not the first 1,000', () => {
    expect(read('src/features/committees/committeeService.js')).toContain("return selectAllPages(()=>{let query=supabase.from(table)")
  })
})
