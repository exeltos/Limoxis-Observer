import { describe, expect, it } from 'vitest'
import { findPatientMatches, markRecordNumberTaken } from '../src/features/patients/patientsService'

const patients = [
  { id: 'PT-1', firstName: 'Ελένη', lastName: 'Παπαδοπούλου', name: 'Ελένη Παπαδοπούλου', dateOfBirth: '1950-03-02', hospitalRecordNumber: '2279249' },
  { id: 'PT-2', firstName: 'Νίκος', lastName: 'Ιωάννου', name: 'Νίκος Ιωάννου', dateOfBirth: null, hospitalRecordNumber: '' },
]

describe('possible duplicate patients', () => {
  it('finds the same name without accents or case, with the same or a missing date of birth', () => {
    expect(findPatientMatches(patients, { firstName: 'ελενη', lastName: 'ΠΑΠΑΔΟΠΟΥΛΟΥ', dateOfBirth: '1950-03-02' }).map(p => p.id)).toEqual(['PT-1'])
    expect(findPatientMatches(patients, { firstName: 'Ελένη', lastName: 'Παπαδοπούλου' }).map(p => p.id)).toEqual(['PT-1'])
    expect(findPatientMatches(patients, { firstName: 'Νίκος', lastName: 'Ιωάννου', dateOfBirth: '1980-01-01' }).map(p => p.id)).toEqual(['PT-2'])
  })

  it('does not match the same name with a different date of birth', () => {
    expect(findPatientMatches(patients, { firstName: 'Ελένη', lastName: 'Παπαδοπούλου', dateOfBirth: '1951-03-02' })).toEqual([])
  })

  it('matches the same hospital record number whatever the name', () => {
    expect(findPatientMatches(patients, { firstName: 'Άλλο', lastName: 'Όνομα', hospitalRecordNumber: ' 2279249 ' }).map(p => p.id)).toEqual(['PT-1'])
  })

  it('matches a full name typed in one field, in either order', () => {
    expect(findPatientMatches(patients, { fullName: 'Ιωάννου Νίκος' }).map(p => p.id)).toEqual(['PT-2'])
    expect(findPatientMatches(patients, { fullName: 'νικος ιωαννου' }).map(p => p.id)).toEqual(['PT-2'])
    expect(findPatientMatches(patients, { fullName: '' })).toEqual([])
  })

  it('recognises the refusal of a record number another admission already has', () => {
    const error = { code: '23505', message: 'ADMISSION_CASE_NUMBER_TAKEN' }
    expect(markRecordNumberTaken(error)).toBe(true)
    expect(error.duplicateRecordNumber).toBe(true)
    expect(markRecordNumberTaken({ code: '23505', message: 'duplicate key value violates unique constraint "patients_organization_id_patient_code_key"' })).toBe(false)
  })
})
