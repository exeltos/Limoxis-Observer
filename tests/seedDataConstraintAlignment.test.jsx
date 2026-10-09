// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { reassessmentDecisionDbValue, reassessmentStatusDbValue, reassessmentStatusUiValue } from '../src/features/surveillance/clinicalCloudService'
import { followupInterventionStatus, interventionStatusDbValue } from '../src/features/surveillance/employeeSurveillanceCloudService'
import { SURVEILLANCE_OUTCOMES, timelineLabel } from '../src/features/surveillance/PatientClinicalCanonicalPage'
import { calculateDeviceDays, deviceRuleKey } from '../src/features/lira/liraHaiMetrics'
import { buildOutbreakLineList } from '../src/features/lira/liraOutbreakInvestigation'
import { sampleSourceLabel } from '../src/features/laboratory/laboratoryReferenceData'

const migrations = fs.readdirSync('supabase/migrations').map(name => fs.readFileSync(`supabase/migrations/${name}`, 'utf8')).join('\n')
const checkList = column => {
  const match = migrations.match(new RegExp(`${column} text not null(?: default '[a-z_]+')? check ?\\(${column} in \\(([^)]*)\\)`))
  return match[1].split(',').map(value => value.trim().replace(/'/g, ''))
}

describe('surveillance reassessment values match the DB check constraints', () => {
  const statuses = checkList('clinical_status')
  it('maps UI statuses to allowed clinical_status values and back', () => {
    for (const ui of ['clinicalImprovement', 'stable', 'deterioration']) expect(statuses).toContain(reassessmentStatusDbValue(ui))
    expect(reassessmentStatusDbValue('clinicalImprovement')).toBe('improved')
    expect(reassessmentStatusDbValue('deterioration')).toBe('deteriorated')
    expect(reassessmentStatusUiValue('improved')).toBe('clinicalImprovement')
    expect(reassessmentStatusUiValue('deteriorated')).toBe('deterioration')
    expect(reassessmentStatusUiValue('stable')).toBe('stable')
  })
  it('maps the dialog decision to an allowed therapy_decision value', () => {
    expect(reassessmentDecisionDbValue('continueTreatment')).toBe('continue')
    expect(reassessmentDecisionDbValue('continueIsolation', ['continue', 'modify', 'discontinue', 'not_applicable'])).toBe('continue')
    expect(reassessmentDecisionDbValue('unknownValue')).toBeNull()
    expect(reassessmentDecisionDbValue('')).toBeNull()
  })
})

describe('employee follow-up intervention_status', () => {
  const allowed = checkList('intervention_status')
  it('never sends not_required', () => {
    expect(followupInterventionStatus({ noIntervention: true })).toBe('none')
    expect(followupInterventionStatus({ intervention: 'Decolonisation' })).toBe('in_progress')
    expect(followupInterventionStatus({})).toBe('none')
    for (const value of ['not_required', 'optional', 'recorded', undefined, 'completed']) expect(allowed).toContain(interventionStatusDbValue(value))
  })
})

describe('surveillance outcome options and timeline', () => {
  it('offers only DB-allowed outcomes', () => {
    const allowed = checkList('outcome')
    expect(SURVEILLANCE_OUTCOMES).not.toContain('improved')
    for (const value of SURVEILLANCE_OUTCOMES) expect(allowed).toContain(value)
  })
  it('labels the DB surveillance_close event and the legacy surveillance_closed one', () => {
    expect(timelineLabel('surveillance_close', 'en', x => x)).toBe('Surveillance closed')
    expect(timelineLabel('surveillance_close', 'el', x => x)).toBe('Ολοκλήρωση επιτήρησης')
    expect(timelineLabel('surveillance_closed', 'en', x => x)).toBe('Surveillance closed')
  })
})

describe('device-days recognise Greek device names', () => {
  it('classifies Greek and English names', () => {
    expect(deviceRuleKey('Ουροκαθετήρας (Foley)')).toBe('cauti')
    expect(deviceRuleKey('Ουροκαθετήρας')).toBe('cauti')
    expect(deviceRuleKey('Μηχανικός αερισμός (ventilator)')).toBe('vap')
    expect(deviceRuleKey('ΜΗΧΑΝΙΚΟΣ ΑΕΡΙΣΜΟΣ')).toBe('vap')
    expect(deviceRuleKey('Κεντρικός φλεβικός καθετήρας')).toBe('clabsi')
    expect(deviceRuleKey('Κεντρική φλεβική γραμμή (PICC)')).toBe('clabsi')
    expect(deviceRuleKey('Περιφερικός φλεβικός καθετήρας')).toBeNull()
    expect(deviceRuleKey('Ουροσυλλέκτης')).toBeNull()
  })
  it('counts device-days for Greek device rows', () => {
    const devices = [{ deviceType: 'Ουροκαθετήρας', insertedAt: '2026-08-01', removedAt: '2026-08-11', department: 'ICU' }]
    expect(calculateDeviceDays(devices, 'cauti', { today: '2026-09-01' })).toBeGreaterThan(0)
    expect(calculateDeviceDays(devices, 'vap', { today: '2026-09-01' })).toBe(0)
  })
})

describe('no raw ids on screen', () => {
  it('line list exposes a patient label instead of the UUID', () => {
    const uuid = '3f2b1c4d-1111-4222-8333-444455556666'
    const list = buildOutbreakLineList({ laboratory: [{ id: 's1', patientId: uuid, patientCode: 'PT-0001', patient: 'Maria P.', collectedAt: '2026-08-01', department: 'ICU', organism: 'K. pneumoniae' }] })
    expect(list.rows[0].patientLabel).toBe('PT-0001')
    expect(list.rows[0].patientKey).toBe(uuid)
    const panel = fs.readFileSync('src/features/management/LiraOutbreakInvestigationsPanel.jsx', 'utf8')
    expect(panel).toContain("<td>{row.patientLabel||'—'}</td>")
    expect(panel).not.toContain("<td>{row.patientKey||'—'}</td>")
  })
  it('localizes employee screening source codes', () => {
    expect(sampleSourceLabel('nasalSwab', 'en')).toBe('Nasal swab')
    expect(sampleSourceLabel('nasalSwab, throatSwab', 'el')).toBe('Ρινικό επίχρισμα, Φαρυγγικό επίχρισμα')
    expect(sampleSourceLabel('urinaryCatheter', 'en')).toBe('Urinary catheter')
    expect(sampleSourceLabel('Free text', 'en')).toBe('Free text')
    expect(fs.readFileSync('src/features/laboratory/LaboratorySampleSummary.jsx', 'utf8')).toContain('sampleSourceLabel(')
  })
})
