import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { auditChecklistFromControl, auditChecklistFromText, auditCompliance, auditProgramme, checklistTemplates, findingDraftFromRow, pendingFindings } from '../src/features/quality/qualityAudit'
import { checklistScore as controlsScore } from '../src/features/controls/controlVocabulary'
import { checklistScore } from '../src/core/checklist/checklistScore'
import { qualityAudits } from '../src/features/quality/qualityDemoData'
import { deviationQueue } from '../src/features/quality/qualityDeviations'

const migration = fs.readFileSync('supabase/migrations/20261104100000_quality_audit_checklists.sql', 'utf8')
const service = fs.readFileSync('src/features/quality/qualityService.js', 'utf8')

describe('Quality audits (phase 3)', () => {
  it('uses a control that is a checklist as the audit template', () => {
    const control = { id: 'c1', status: 'active', responseConfig: { mode: 'checklist', checklist: [{ id: 'a', el: 'Σήμανση', en: 'Sign' }, { id: 'b', el: 'ΜΑΠ', en: 'PPE', required: false }] } }
    expect(checklistTemplates([control, { id: 'c2', responseConfig: { mode: 'numeric' } }]).map(item => item.id)).toEqual(['c1'])
    expect(auditChecklistFromControl(control)).toEqual([{ id: 'a', item: 'Σήμανση', itemEn: 'Sign', required: true, answer: '', note: '' }, { id: 'b', item: 'ΜΑΠ', itemEn: 'PPE', required: false, answer: '', note: '' }])
  })

  it('reads typed items one per line', () => {
    expect(auditChecklistFromText('1. Σήμανση\n- ΜΑΠ\n\n  Απολύμανση ').map(row => row.item)).toEqual(['Σήμανση', 'ΜΑΠ', 'Απολύμανση'])
  })

  it('scores compliance over applicable answers and lists the «No» without a finding', () => {
    const rows = [{ answer: 'yes' }, { answer: 'no', id: 'x' }, { answer: 'no', id: 'y', findingId: 'FND-1' }, { answer: 'na' }]
    expect(auditCompliance({ checklist: rows })).toMatchObject({ applicable: 3, yes: 1, rate: 33 })
    expect(pendingFindings(rows).map(row => row.id)).toEqual(['x'])
  })

  it('makes each «No» a finding of the audit', () => {
    const draft = findingDraftFromRow({ id: 'AUD-1', department: 'ΜΕΘ', departmentId: 'd1', plannedDate: '2026-10-02' }, { item: 'Σήμανση', note: 'Λείπει' })
    expect(draft).toMatchObject({ title: 'Σήμανση', source: 'audit', sourceId: 'AUD-1', department: 'ΜΕΘ', status: 'open', date: '2026-10-02' })
    expect(draft.description).toContain('Λείπει')
  })

  it('lays out the year programme month by month', () => {
    const months = auditProgramme([{ id: 'a', plannedDate: '2026-03-04' }, { id: 'b', plannedDate: '2026-03-01' }, { id: 'c', plannedDate: '2025-03-01' }], 2026)
    expect(months).toHaveLength(12)
    expect(months[2].audits.map(audit => audit.id)).toEqual(['b', 'a'])
  })

  it('shares one checklist score between Controls and audits', () => {
    expect(controlsScore).toBe(checklistScore)
  })

  it('gives the demo audits checklists whose «No» answers point at their findings', () => {
    const withNo = qualityAudits.flatMap(audit => audit.checklist || []).filter(row => row.answer === 'no')
    expect(withNo.length).toBeGreaterThan(0)
    expect(withNo.every(row => row.findingId)).toBe(true)
  })

  it('stores the checklist on the audit', () => {
    expect(migration).toContain("add column if not exists checklist jsonb not null default '[]'::jsonb")
    expect(migration).toContain("check (jsonb_typeof(checklist) = 'array')")
    expect(service).toContain('checklist_source:record.checklistSource||null')
  })

  it('brings trainings that did not change practice into the register', () => {
    const items = deviationQueue({ trainings: [{ id: 'TRN-1', title: 'CLABSI', effectiveness: { result: 'partial', evaluatedAt: new Date().toISOString().slice(0, 10) } }, { id: 'TRN-2', title: 'OK', effectiveness: { result: 'effective', evaluatedAt: new Date().toISOString().slice(0, 10) } }] })
    expect(items.map(item => item.sourceId)).toEqual(['TRAINING:TRN-1'])
    expect(deviationQueue({ trainings: [{ id: 'TRN-1', effectiveness: { result: 'partial', evaluatedAt: new Date().toISOString().slice(0, 10) } }], capas: [{ sourceId: 'TRAINING:TRN-1' }] })).toHaveLength(0)
  })
})
