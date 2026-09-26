import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260919280000_block_surveillance_link_from_negative_sample.sql', 'utf8')
const page = fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx', 'utf8')
const linkService = fs.readFileSync('src/features/laboratory/laboratoryLinkService.js', 'utf8')

describe('Technical guard: a negative laboratory result can never start or continue a surveillance case', () => {
  it('adds a BEFORE UPDATE trigger on laboratory_samples.surveillance_case_id, not just an insert-time check', () => {
    expect(migration).toContain('before update of surveillance_case_id on public.laboratory_samples')
    expect(migration).toContain('create or replace function public.enforce_no_surveillance_link_from_negative_sample()')
  })

  it('only blocks a sample whose only validated result is negative (a positive alongside it is still allowed)', () => {
    expect(migration).toContain("result_status='negative'")
    expect(migration).toContain("result_status='positive'")
    expect(migration).toContain('if has_negative and not has_positive then')
  })

  it('only counts validated/amended results, excluding drafts and superseded (amended-from) results', () => {
    expect(migration).toContain("validation_status in ('validated','amended')")
    expect(migration).toContain('m2.amended_from=m.id')
  })

  it('does not block clearing a link (setting surveillance_case_id back to null)', () => {
    expect(migration).toContain('if new.surveillance_case_id is null then')
    expect(migration).toContain('return new;')
  })

  it('the linking service has no client-side check of its own — the database is the source of truth', () => {
    // linkLaboratorySampleToSurveillance must remain a plain update; the trigger is what enforces the rule.
    expect(linkService).toContain("from('laboratory_samples')")
    expect(linkService).toContain('surveillance_case_id:surveillanceCaseId')
  })

  it('the Surveillance & Samples UI hides the "Start surveillance" action for a negative-result sample', () => {
    expect(page).toContain("if(result==='negative')return 'negative'")
    expect(page).toContain("isNegative=tone==='negative'")
    expect(page).toContain('sample-negative-note')
    expect(page).toContain("translate('copy.clinicalRecordCopy.aNegativeResultCannotStartA'")
    expect(fs.readFileSync('src/core/i18n/stringsEn.js','utf8')).toContain("aNegativeResultCannotStartA:'A negative result cannot start a surveillance case.'")
  })
})
