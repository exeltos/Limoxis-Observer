import { describe, expect, it } from 'vitest'
import { environmentalPlateText, environmentalSheetDocument } from '../src/features/surveillance/environmentalSamplingSheet'

const words = { 'clinicalRecords.envPlate': 'Τρυβλίο', 'clinicalRecords.envPosition': 'Θέση', 'clinicalRecords.envSheetKind': 'Περιβαλλοντική επιτήρηση', 'clinicalRecords.envSheetTitle': 'Φύλλο καταγραφής', 'clinicalRecords.envSheetPoints': 'Σημεία', 'clinicalRecords.envSheetSampler': 'Δειγματολήπτης', 'clinicalRecords.envSheetLab': 'Παραλαβή', locationArea: 'Χώρος', samplingPoint: 'Σημείο', samplingDate: 'Ημερομηνία', sampleType: 'Τύπος', samplingMethod: 'Μέθοδος', department: 'Τμήμα', notes: 'Σημειώσεις', sampleCode: 'Κωδικός' }
const t = key => words[key] || key

describe('environmental recording sheet', () => {
  it('names the plate and the spot of a sample, whichever it has', () => {
    expect(environmentalPlateText({ environmentalPlate: 'Α', environmentalPosition: '1' }, t)).toBe('Τρυβλίο Α · Θέση 1')
    expect(environmentalPlateText({ environmentalPosition: '3' }, t)).toBe('Θέση 3')
    expect(environmentalPlateText({}, t)).toBe('')
  })

  it('lists one row per point with its plate and spot, and the two signatures', () => {
    const doc = environmentalSheetDocument({ t, department: 'ΜΕΘ', date: '25/10/2026', typeLabel: 'Επιφάνεια', methodLabel: 'Επίχρισμα', code: 'ENVB-1', points: [{ location: 'ΜΕΘ', point: 'Κλίνη 4', plate: 'Α', position: '1' }, { location: 'ΜΕΘ', point: 'Κλίνη 5', plate: 'Α', position: '2' }] })
    const table = doc.sections[0].table
    expect(table.columns).toEqual(['#', 'Χώρος', 'Σημείο', 'Τρυβλίο', 'Θέση', 'Σημειώσεις'])
    expect(table.rows.map(row => [row[0], row[2], row[3].text, row[4].text])).toEqual([['1', 'Κλίνη 4', 'Α', '1'], ['2', 'Κλίνη 5', 'Α', '2']])
    expect(doc.signatures).toEqual(['Δειγματολήπτης', 'Παραλαβή'])
    expect(doc.meta.map(([label]) => label)).toEqual(['Τμήμα', 'Ημερομηνία', 'Τύπος', 'Μέθοδος'])
  })

  it('adds the sample code column once the points are saved', () => {
    const doc = environmentalSheetDocument({ t, points: [{ point: 'Κλίνη 4', plate: 'Α', position: '1', code: 'ENV-260826-001' }] })
    expect(doc.sections[0].table.columns).toContain('Κωδικός')
    expect(doc.sections[0].table.rows[0]).toContain('ENV-260826-001')
  })
})
