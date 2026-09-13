import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('indicator calculation integrity and governance links',()=>{
 const migration=read('supabase/migrations/202609130011_indicator_metric_integrity_committee_links.sql')
 const autoLink=read('supabase/migrations/202609130012_committee_indicator_reference_autolink.sql')
 const page=read('src/features/indicators/IndicatorsPage.jsx')
 const record=read('src/features/indicators/IndicatorRecordPage.jsx')
 const committeeService=read('src/features/indicators/indicatorCommitteeService.js')
 const review=read('src/features/training/TrainingResultsReview.jsx')
 const reviewCss=read('src/features/training/TrainingResultsReview.css')

 it('uses the canonical training assignment source for training completion',()=>{
  expect(migration).toContain("from public.training_records t")
  expect(migration).toContain("t.record_type='assignment'")
  expect(migration).not.toContain('from public.employee_training_summary t')
 })

 it('counts surveillance episodes overlapping the reporting period',()=>{
  expect(migration).toContain('s.started_at::date<=p_to')
  expect(migration).toContain("s.closed_at is null or s.closed_at::date>=p_from")
  expect(migration).toContain('s.voided_at is null')
 })

 it('calculates vaccination coverage as valid coverage at the reporting cutoff',()=>{
  expect(migration).toContain('v.vaccination_date<=p_to')
  expect(migration).toContain('v.valid_until is null or v.valid_until>=p_to')
 })

 it('restricts the MDRO bloodstream numerator to blood specimens',()=>{
  expect(migration).toContain("lower(coalesce(l.sample_type,'')) like '%blood%'")
  expect(migration).toContain('MDR/XDR/PDR βακτηριαιμίες')
 })

 it('makes manual definitions enterable and approvable in the indicator board',()=>{
  expect(page).toContain('indicator-manual-value')
  expect(page).toContain('updateManualValue')
  expect(page).toContain("r.calculation==='manual'&&canManage")
  expect(page).toContain("disabled={approved||saving||loading}")
 })

 it('links committee annual-plan objectives to governed indicator definitions',()=>{
  expect(migration).toContain('indicator_definition_id uuid')
  expect(migration).toContain('committee_plan_items_indicator_definition_fk')
  expect(autoLink).toContain('sync_committee_plan_indicator_reference')
  expect(autoLink).toContain('lower(btrim(d.title_el))=lower(btrim(new.indicator))')
  expect(committeeService).toContain(".from('committee_plan_items')")
  expect(record).toContain('Στόχοι επιτροπών που χρησιμοποιούν τον δείκτη')
 })

 it('keeps participant review terminology and checkbox layout explicit',()=>{
  expect(review).toContain('Κατάσταση ελέγχου')
  expect(review).toContain('Απαντήσεις αξιολόγησης γνώσεων')
  expect(review).toContain('training-review-check')
  expect(reviewCss).toContain('flex-direction:row!important')
  expect(reviewCss).toContain("input[type='checkbox']")
 })
})
