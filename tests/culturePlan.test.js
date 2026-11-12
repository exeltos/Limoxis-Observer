import { describe, expect, it } from 'vitest'
import { CULTURE_CATEGORY, cultureItems, cultureYear, everyMonths, offProgramme, roundMatches, samplingRounds } from '../src/features/surveillance/culturePlan'
import { readSource } from './helpers/readSource'

const sample = (department, day, type = 'surface', outside = false) => ({ department, collectedAt: `${day}T09:00:00Z`, type, outside })

describe('the culture programme', () => {
  const controls = [
    { code: 'C1', title: 'Καλλιέργειες επιφανειών ΜΕΘ', category: 'Περιβαλλοντικός μικροβιολογικός έλεγχος', frequency: { kind: 'monthly', interval: 4 }, cultureDepartment: 'ΜΕΘ', cultureSampleTypes: ['surface'] },
    { code: 'C2', title: 'Καλλιέργειες κλιβάνων', category: 'Περιβαλλοντικός μικροβιολογικός έλεγχος', frequency: { kind: 'monthly', interval: 1 }, cultureDepartment: 'Αποστείρωση', cultureSampleTypes: ['equipment'] },
    { code: 'X', title: 'Θερμοκρασία', category: 'Έλεγχος θερμοκρασίας', frequency: { kind: 'daily' } },
  ]
  const items = cultureItems(controls)
  const rounds = samplingRounds([
    sample('ΜΕΘ', '2025-11-10'), sample('ΜΕΘ', '2026-04-28'), sample('ΜΕΘ', '2026-04-28', 'surface', true),
    sample('Αποστείρωση', '2026-01-15', 'equipment'), sample('Αποστείρωση', '2026-02-11', 'surface'), sample('ΤΕΠ', '2026-05-11'),
  ])
  const today = new Date('2026-06-15T12:00:00Z')

  it('takes only the environmental cultures, with their department and frequency', () => {
    expect(items.map(item => [item.department, item.every])).toEqual([['Αποστείρωση', 1], ['ΜΕΘ', 4]])
    expect(everyMonths({ kind: 'yearly', interval: 1 })).toBe(12)
    expect(everyMonths({ kind: 'daily' })).toBe(1)
  })
  it('groups the samples of a department and day into one round, counting those out of limit', () => {
    const icu = rounds.find(round => round.department === 'ΜΕΘ' && round.day === '2026-04-28')
    expect(icu.samples).toHaveLength(2)
    expect(icu.outside).toBe(1)
  })
  it('reads «done» from the laboratory, by department and kind of sample', () => {
    const autoclaves = items.find(item => item.department === 'Αποστείρωση')
    expect(roundMatches(autoclaves, rounds.find(round => round.day === '2026-02-11'))).toBe(false)
    const months = cultureYear(autoclaves, rounds, 2026, today)
    expect(months.slice(0, 7).map(cell => cell.state)).toEqual(['done', 'missed', 'missed', 'missed', 'missed', 'due', 'planned'])
  })
  it('counts «every n months» from the last time it was done', () => {
    const icu = items.find(item => item.department === 'ΜΕΘ')
    const months = cultureYear(icu, rounds, 2026, today)
    // Done in November 2025: due in March (missed), done in April, next in August.
    expect(months.map(cell => cell.state)).toEqual(['', '', 'missed', 'done', '', '', '', 'planned', '', '', '', 'planned'])
  })
  it('shows the rounds of departments with no culture in the programme apart', () => {
    // The surfaces of the sterilisation unit are not in the programme here (only its autoclaves): out of programme too.
    expect(offProgramme(items, rounds, 2026).map(round => round.department)).toEqual(['Αποστείρωση', 'ΤΕΠ'])
  })
  it('is an entry of its own under Controls in the menu, for the infection control lead and the administrator only', () => {
    expect(readSource('src/core/navigation/sectionTabs.js')).not.toContain("id: 'cultures'")
    expect(readSource('src/app/navigation.js')).toContain("{to:'/controls/cultures',key:'cultureProgramme'")
    expect(readSource('src/app/App.jsx')).toContain('<Route path="controls/cultures"')
    expect(readSource('src/features/surveillance/surveillanceTabAccess.js')).toContain('([ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD] as string[]).includes(role)')
  })
})

describe('culture programme before the first sample', () => {
  it('judges nothing before the laboratory first recorded an environmental sample', () => {
    const item = { department: 'ΜΕΘ', sampleTypes: [], every: 1 }
    const rounds = samplingRounds([{ department: 'ΜΕΘ', collectedAt: '2026-10-05', type: 'surface' }])
    const months = cultureYear(item, rounds, 2026, new Date('2026-11-15T12:00:00Z'), rounds[0].day)
    expect(months.slice(0, 9).every(cell => cell.state === '')).toBe(true)
    expect(months[9].state).toBe('done')
    expect(months[10].state).toBe('due')
  })
})

describe('culture programme categories (staff, air, network water)', () => {
  const definitions = [
    { code: 'D', title: 'Νερό αιμοκάθαρσης', category: CULTURE_CATEGORY, status: 'active', frequency: { kind: 'monthly', interval: 1 }, cultureDepartment: 'ΜΤΝ', cultureSampleTypes: ['water'] },
    { code: 'W', title: 'Νερό δικτύου', category: CULTURE_CATEGORY, status: 'active', frequency: { kind: 'monthly', interval: 6 }, cultureGroup: 'network_water' },
  ]
  it('puts a group after the departments and takes its kind of sample from any department not claiming it', () => {
    const items = cultureItems(definitions)
    expect(items.map(item => item.group || item.department)).toEqual(['ΜΤΝ', 'network_water'])
    const rounds = samplingRounds([sample('ΜΤΝ', '2026-03-02', 'water'), sample('Αποστείρωση', '2026-03-10', 'water')])
    expect(rounds.filter(round => roundMatches(items[1], round)).map(round => round.department)).toEqual(['Αποστείρωση'])
    expect(offProgramme(items, rounds, 2026)).toEqual([])
  })
})
