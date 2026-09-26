import { describe, expect, it } from 'vitest'
import { ageInYears, buildEarsNetRows, earsNetAntibiotic, earsNetIsolates, earsNetPathogen, earsNetSpecimen, firstIsolates, micOf, patientTypeOf, pseudonym, toCsv } from '../src/features/reporting/earsNet'
import { notifiableFindings, notifiableRuleFor } from '../src/features/reporting/notifiableFindings'
import { runDataQualityChecks } from '../src/features/reporting/dataQuality'
import { collectAmrSusceptibility } from '../src/features/analysis/analysisDemoSnapshot'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { normalizeLaboratorySamples } from '../src/features/laboratory/model/laboratoryModel'

const blood = (id, patientId, organism, collectedAt, ast = [], extra = {}) => ({ id, patientId, subjectType: 'patient', type: 'bloodCulture', department: 'ΜΕΘ', organism, result: 'positive', resultStatus: 'validated', collectedAt, receivedAt: collectedAt, resultedAt: collectedAt, ast, ...extra })
const mem = sir => ({ drug: 'Meropenem', sir, mic: sir === 'R' ? '≥16' : '0.25', standard: 'EUCAST', version: '16.0' })

describe('EARS-Net', () => {
  it('maps pathogens, antibiotics and specimens to EARS-Net codes', () => {
    expect(earsNetPathogen('Klebsiella pneumoniae')).toBe('KLEPNE')
    expect(earsNetPathogen('Enterococcus faecium (VRE)')).toBe('ENCFAI')
    expect(earsNetPathogen('Klebsiella oxytoca')).toBeNull()
    expect(earsNetAntibiotic({ drug: 'Ceftazidime/avibactam' })).toBe('CZA')
    expect(earsNetAntibiotic({ drug: 'Ceftazidime' })).toBe('CAZ')
    expect(earsNetAntibiotic({ drug: 'Piperacillin-tazobactam' })).toBe('TZP')
    expect(earsNetAntibiotic({ code: 'ABX-MEM', drug: '' })).toBe('MEM')
    expect(earsNetSpecimen({ type: 'bloodCulture' })).toBe('BLOOD')
    expect(earsNetSpecimen({ type: 'other', source: 'ΕΝΥ' })).toBe('CSF')
    expect(earsNetSpecimen({ type: 'urineCulture' })).toBeNull()
  })

  it('keeps only the first isolate per patient, pathogen and year', () => {
    const samples = [
      blood('S2', 'P1', 'Klebsiella pneumoniae', '2026-03-05', [mem('R')]),
      blood('S1', 'P1', 'Klebsiella pneumoniae', '2026-03-01', [mem('S')]),
      blood('S3', 'P1', 'Escherichia coli', '2026-03-02', [mem('S')]),
      blood('S4', 'P1', 'Klebsiella pneumoniae', '2027-01-10', [mem('R')]),
      blood('S5', 'P2', 'Klebsiella pneumoniae', '2026-03-05', [mem('R')]),
      { ...blood('S6', 'P3', 'Klebsiella pneumoniae', '2026-03-05', [mem('R')]), type: 'urineCulture' },
      { ...blood('S7', 'P4', 'Klebsiella pneumoniae', '2026-03-05', [mem('R')]), resultStatus: 'draft' },
    ]
    const first = firstIsolates(earsNetIsolates(samples)).map(isolate => isolate.sample.id)
    expect(first).toEqual(['S1', 'S3', 'S5', 'S4'])
  })

  it('builds pseudonymous TESSy rows with demographics and MIC sign', () => {
    const samples = normalizeLaboratorySamples([blood('LAB-1', 'PT-1', 'Klebsiella pneumoniae', '2026-08-27T00:35:00+03:00', [mem('R'), { drug: 'Fosfomycin', sir: 'S' }])])
    const built = buildEarsNetRows(samples, { patients: [{ id: 'PT-1', sex: 'female', dateOfBirth: '1950-09-01', departmentType: 'icu' }], year: 2026, hospitalId: 'H1', salt: 'org' })
    expect(built.isolates).toBe(1)
    expect(built.rows).toHaveLength(1)
    expect(built.unmapped).toEqual([['Fosfomycin', 1]])
    const [row] = built.rows
    expect(row).toMatchObject({ ReportingCountry: 'EL', Specimen: 'BLOOD', Gender: 'F', Age: '75', HospitalUnitType: 'ICU', HospitalId: 'H1', Pathogen: 'KLEPNE', Antibiotic: 'MEM', SIR: 'R', ResultMICSign: '>=', ResultMICValue: '16', ReferenceGuidelinesSIR: 'EUCAST 16.0', DateUsedForStatistics: '2026-08-27' })
    expect(row.PatientCounter).toBe(pseudonym('PT-1', 'org'))
    expect(JSON.stringify(row)).not.toContain('PT-1')
    expect(toCsv(built.rows).split('\r\n')[0]).toMatch(/^RecordId,ReportingCountry,/)
  })

  it('computes age in completed years', () => {
    expect(ageInYears('2000-06-15', '2026-06-14')).toBe('25')
    expect(ageInYears('2000-06-15', '2026-06-15')).toBe('26')
    expect(ageInYears('', '2026-06-15')).toBe('')
  })
})

describe('ΕΟΔΥ notifiable findings', () => {
  it('matches notifiable organisms, with invasive and carbapenem conditions', () => {
    expect(notifiableRuleFor({ type: 'bloodCulture' }, { organism: 'Neisseria meningitidis' })?.id).toBe('meningococcal')
    expect(notifiableRuleFor({ type: 'other' }, { organism: 'Salmonella enterica serovar Typhi' })?.id).toBe('typhoid')
    expect(notifiableRuleFor({ type: 'other' }, { organism: 'Salmonella enteritidis' })?.id).toBe('salmonellosis')
    expect(notifiableRuleFor({ type: 'respiratorySample' }, { organism: 'Streptococcus pneumoniae' })).toBeNull()
    expect(notifiableRuleFor({ type: 'bloodCulture' }, { organism: 'Streptococcus pneumoniae' })?.id).toBe('invasive_pneumococcal')
    expect(notifiableRuleFor({ type: 'bloodCulture' }, { organism: 'Klebsiella pneumoniae', ast: [mem('S')] })).toBeNull()
    expect(notifiableRuleFor({ type: 'bloodCulture' }, { organism: 'Klebsiella pneumoniae', ast: [mem('R')] })?.id).toBe('carbapenem_resistant_bacteraemia')
    expect(notifiableRuleFor({ type: 'urineCulture' }, { organism: 'Klebsiella pneumoniae', ast: [mem('R')] })).toBeNull()
  })

  it('lists validated patient findings with their saved report', () => {
    const samples = normalizeLaboratorySamples([blood('LAB-2', 'PT-2', 'Neisseria meningitidis', '2026-09-01'), { ...blood('LAB-3', 'PT-3', 'Neisseria meningitidis', '2026-09-02'), resultStatus: 'draft' }])
    const [finding, ...rest] = notifiableFindings(samples, [{ findingKey: `LAB-2|LAB-2-result|meningococcal`, status: 'notified' }])
    expect(rest).toHaveLength(0)
    expect(finding.rule.id).toBe('meningococcal')
    expect(finding.report?.status).toBe('notified')
  })

  it('finds the carbapenem-resistant bacteraemias in the demo data', () => {
    const findings = notifiableFindings(normalizeLaboratorySamples(laboratorySamples))
    expect(findings.some(finding => finding.rule.id === 'carbapenem_resistant_bacteraemia')).toBe(true)
  })
})

describe('data quality', () => {
  const now = new Date('2026-09-26T12:00:00Z')
  const byId = checks => Object.fromEntries(checks.map(check => [check.id, check.items.map(item => item.id)]))

  it('flags incomplete and inconsistent records', () => {
    const samples = normalizeLaboratorySamples([
      blood('A', 'P1', '', '2026-09-01'),
      blood('B', 'P1', 'Klebsiella pneumoniae', '2026-09-02', []),
      { ...blood('C', 'P2', 'Escherichia coli', '2026-09-03T10:00:00Z', [{ drug: 'Ceftriaxone', sir: 'S' }]), receivedAt: '2026-09-03T09:00:00Z' },
      { ...blood('D', '', 'Escherichia coli', '2026-09-03', [mem('S')]), department: '' },
      { ...blood('E', 'P3', 'Escherichia coli', '2026-09-01', [mem('S')]), resultStatus: 'preliminary', resultedAt: '2026-09-10' },
      blood('F1', 'P4', 'Escherichia coli', '2026-09-04T08:00:00Z', [mem('S')]),
      blood('F2', 'P4', 'Escherichia coli', '2026-09-04T09:00:00Z', [mem('S')]),
    ])
    const patients = [{ id: 'P1', name: 'A', sex: '', dateOfBirth: '1960-01-01' }, { id: 'P9', name: 'Infant', dateOfBirth: '2026-05-01', birthWeightGrams: null }]
    const found = byId(runDataQualityChecks({ samples, patients, now }))
    expect(found.positive_without_organism).toEqual(['A'])
    expect(found.invasive_without_ast).toEqual(['B'])
    expect(found.ast_without_standard).toEqual(['C'])
    expect(found.impossible_timeline).toEqual(['C'])
    expect(found.missing_department).toEqual(['D'])
    expect(found.missing_patient).toEqual(['D'])
    expect(found.stale_unvalidated).toEqual(['E'])
    expect(found.possible_duplicate_sample).toEqual(['F1', 'F2'])
    expect(found.reporting_demographics).toEqual(['P1'])
    expect(found.infant_without_birth_weight).toEqual(['P9'])
  })
})

describe('AMR susceptibility (demo) counts first isolates only', () => {
  it('drops a repeat isolate of the same patient, organism and year', () => {
    const rows = collectAmrSusceptibility([
      blood('K1', 'P1', 'Klebsiella pneumoniae', '2026-01-01', [mem('S')]),
      blood('K2', 'P1', 'Klebsiella pneumoniae', '2026-02-01', [mem('R')]),
      blood('K3', 'P2', 'Klebsiella pneumoniae', '2026-02-01', [mem('R')]),
    ])
    expect(rows).toEqual([['Klebsiella spp.', 2, 1]])
  })
})

describe('review fixes', () => {
  it('maps library codes and Greek names to EARS-Net codes', () => {
    expect(earsNetAntibiotic({ code: 'ABX-PTZ', drug: 'Πιπερακιλλίνη/Ταζομπακτάμη' })).toBe('TZP')
    expect(earsNetAntibiotic({ drug: 'Μεροπενέμη' })).toBe('MEM')
    expect(earsNetAntibiotic({ drug: 'Κεφταζιδίμη/Αβιβακτάμη' })).toBe('CZA')
  })

  it('keeps the stored MIC operator', () => {
    expect(micOf({ mic: 16, operator: '>=' })).toEqual({ sign: '>=', value: '16' })
    expect(micOf({ mic: '≤0.25' })).toEqual({ sign: '<=', value: '0.25' })
    expect(micOf({ mic: '2' })).toEqual({ sign: '=', value: '2' })
    expect(micOf({ mic: '' })).toEqual({ sign: '', value: '' })
  })

  it('reports inpatient only within a recorded admission', () => {
    expect(patientTypeOf({ admissionDate: '2026-08-01' }, '2026-08-10')).toBe('INPAT')
    expect(patientTypeOf({ admissionDate: '2026-08-01', dischargeDate: '2026-08-05' }, '2026-08-10')).toBe('UNK')
    expect(patientTypeOf({}, '2026-08-10')).toBe('UNK')
  })

  it('splits polymicrobial results into one isolate per organism with its own tests', () => {
    const samples = normalizeLaboratorySamples([blood('P1', 'PT-1', 'Escherichia coli, Klebsiella pneumoniae', '2026-05-01', [{ organism: 'Escherichia coli', drug: 'Ceftriaxone', sir: 'S' }, { organism: 'Klebsiella pneumoniae', drug: 'Meropenem', sir: 'R' }])])
    const isolates = earsNetIsolates(samples)
    expect(isolates.map(isolate => [isolate.pathogen, isolate.tests.map(test => test.drug)])).toEqual([['ESCCOL', ['Ceftriaxone']], ['KLEPNE', ['Meropenem']]])
    const { rows } = buildEarsNetRows(samples, { year: 2026 })
    expect(rows.map(row => `${row.Pathogen}:${row.Antibiotic}`)).toEqual(['ESCCOL:CRO', 'KLEPNE:MEM'])
  })

  it('ignores results superseded by an amendment', () => {
    const sample = { id: 'A1', patientId: 'PT-1', subjectType: 'patient', type: 'bloodCulture', collectedAt: '2026-05-01', microbiologyResults: [
      { id: 'r1', result: 'positive', resultStatus: 'validated', organism: 'Neisseria meningitidis', ast: [] },
      { id: 'r2', amendedFrom: 'r1', result: 'positive', resultStatus: 'amended', organism: 'Neisseria meningitidis', ast: [] },
    ] }
    const findings = notifiableFindings([sample])
    expect(findings).toHaveLength(1)
    expect(findings[0].result.id).toBe('r2')
    expect(findings[0].findingKey).toBe('A1|r1|meningococcal')
    expect(earsNetIsolates([{ ...sample, microbiologyResults: sample.microbiologyResults.map(result => ({ ...result, organism: 'Klebsiella pneumoniae' })) }])).toHaveLength(1)
  })

  it('limits carbapenem-resistant bacteraemia to blood and recognises codes behind Greek names', () => {
    const greekMem = { code: 'ABX-MEM', drug: 'Μεροπενέμη', sir: 'R' }
    expect(notifiableRuleFor({ type: 'bloodCulture' }, { organism: 'Klebsiella pneumoniae', ast: [greekMem] })?.id).toBe('carbapenem_resistant_bacteraemia')
    expect(notifiableRuleFor({ type: 'other', source: 'ΕΝΥ' }, { organism: 'Klebsiella pneumoniae', ast: [greekMem] })).toBeNull()
    expect(notifiableRuleFor({ type: 'other', source: 'CSF' }, { organism: 'Streptococcus pneumoniae' })?.id).toBe('invasive_pneumococcal')
  })
})
