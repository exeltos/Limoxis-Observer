import { describe, expect, it } from 'vitest'
import { ROLES } from '../src/core/permissions/roles'
import { canSeeStaffNames, maskStaffSamples, STAFF_NAME_MASK } from '../src/features/laboratory/sampleReviewModel'
import { groupPlates, platePointText } from '../src/features/laboratory/laboratoryPlates'

const staff = (extra = {}) => ({ id: 'E1', subjectType: 'employee', subjectName: 'ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ', patient: 'ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ', patientEn: 'ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ', subjectCode: '760', source: 'handSwab', environmentalPlate: 'Α', environmentalPosition: '1', collectedAt: '2026-10-01T05:00:00Z', ...extra })

describe('names of staff-check samples', () => {
  it('are seen only by the hospital administrator, the head of infection control and the platform owner', () => {
    expect(canSeeStaffNames(ROLES.HOSPITAL_ADMIN)).toBe(true)
    expect(canSeeStaffNames(ROLES.INFECTION_CONTROL_LEAD)).toBe(true)
    expect(canSeeStaffNames(ROLES.PLATFORM_OWNER)).toBe(true)
    expect(canSeeStaffNames(ROLES.LABORATORY)).toBe(false)
    expect(canSeeStaffNames(ROLES.INFECTION_CONTROL_MEMBER)).toBe(false)
  })

  it('are replaced by a placeholder for the other roles, keeping the employee code; other samples are untouched', () => {
    const rows = [staff(), { id: 'P1', subjectType: 'patient', patient: 'ΑΣΘΕΝΗΣ' }]
    const masked = maskStaffSamples(rows, ROLES.LABORATORY)
    expect(masked[0]).toMatchObject({ subjectName: STAFF_NAME_MASK, patient: STAFF_NAME_MASK, staffMasked: true, subjectCode: '760' })
    expect(masked[1]).toBe(rows[1])
    expect(maskStaffSamples(rows, ROLES.HOSPITAL_ADMIN)).toBe(rows)
  })

  it('are left out of a print for those who may not see them, or when the print asks for it, leaving the swab and the code', () => {
    const masked = maskStaffSamples([staff()], ROLES.LABORATORY)[0]
    expect(platePointText(masked, 'el', true)).toBe('Επίχρισμα χεριών · Κωδ. εργαζομένου 760')
    expect(platePointText(staff(), 'el', true)).toBe('ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ · Επίχρισμα χεριών · Κωδ. εργαζομένου 760')
    expect(platePointText(staff(), 'el', false)).toBe('Επίχρισμα χεριών · Κωδ. εργαζομένου 760')
    expect(groupPlates([masked])[0].samples[0].staffMasked).toBe(true)
  })
})
