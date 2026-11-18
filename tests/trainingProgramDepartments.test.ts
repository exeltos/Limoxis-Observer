import { describe, expect, it } from 'vitest'
import { programOrganizerMap } from '../src/features/training/trainingProgramDepartments'
import { readSource } from './helpers/readSource'

describe('Training list: type and organising department', () => {
  it('the organiser is kept as the department, a person counts as their department', () => {
    const programs = [{ id: 'a', owner: 'Ποιότητα & Ασφάλεια' }, { id: 'b', owner: 'Μαρία Παπαδοπούλου' }, { id: 'c', owner: '' }] as never
    const map = programOrganizerMap(programs, [{ firstName: 'Μαρία', lastName: 'Παπαδοπούλου', department: 'ΜΕΘ' }])
    expect(map.get('a')).toBe('Ποιότητα & Ασφάλεια')
    expect(map.get('b')).toBe('ΜΕΘ')
    expect(map.get('c')).toBe('')
  })
  it('the list has the Type and Department columns and both filters', () => {
    const page = readSource('src/features/training/TrainingProductionPage.tsx')
    expect(page).toContain("label={en?'Type':'Είδος'}")
    expect(page).toContain("label={en?'Department':'Τμήμα'}")
    expect(page).toContain("label={en?'Organising department':'Τμήμα διοργάνωσης'}")
    expect(page).toContain("(departmentFilter==='all'||programDepartments.get(x.id)===departmentFilter)")
  })
})
