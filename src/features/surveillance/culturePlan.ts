import { hospitalDate } from '../../core/dates/hospitalDate'
import type { CultureControl, CultureFrequency, CultureItem, CultureMonth, CultureSample, SamplingRound } from './environmentTypes'
// The culture programme (Surveillance › Culture programme): which environmental cultures are due when, per department, and
// which were done — read from the laboratory's environmental samples (department + kind of sample), never entered twice.

export const CULTURE_CATEGORY = 'Περιβαλλοντικός μικροβιολογικός έλεγχος'

// Cultures that belong to no one department (owner, 2/11/2026): staff, air, network water. Each is one row of the programme,
// done when a sample of its kind is taken in any department (the staff cultures are the employees' screening samples).
export const CULTURE_GROUPS: Readonly<Record<string, { types: string[], label: string[] }>> = Object.freeze({
  staff: { types: ['staff'], label: ['Προσωπικό', 'Staff'] },
  air: { types: ['air'], label: ['Αέρας', 'Air'] },
  network_water: { types: ['water'], label: ['Νερό δικτύου', 'Network water'] },
})

// Every how many months a culture is due, from its frequency (monthly every n; yearly; anything more often counts monthly).
export function everyMonths(frequency: CultureFrequency | null | undefined = {}) {
  const interval = Math.max(1, Number(frequency?.interval) || 1)
  if (frequency?.kind === 'yearly') return 12 * interval
  if (frequency?.kind === 'monthly') return interval
  return 1
}

const dayOf = (value: unknown) => String(value || '').slice(0, 10)
const monthIndex = (day: string, year: number) => (Number(day.slice(0, 4)) - year) * 12 + Number(day.slice(5, 7)) - 1

// The sampling rounds: the environmental samples of one department on one day.
export function samplingRounds(samples: CultureSample[] = []): SamplingRound[] {
  const rounds = new Map<string, SamplingRound>()
  for (const sample of samples) {
    const day = dayOf(sample.collectedAt)
    if (!day || !sample.department) continue
    const key = `${sample.department}|${day}`
    const round = rounds.get(key) || { key, department: sample.department, day, types: new Set(), samples: [], outside: 0 }
    round.types.add(sample.type || '')
    round.samples.push(sample)
    if (sample.outside) round.outside += 1
    rounds.set(key, round)
  }
  return [...rounds.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// A round belongs to a culture of the programme when it is in its department and, where the culture names kinds of sample,
// it has one of them (the surfaces and the autoclaves of the same department are two cultures).
// A culture of a group (air, network water, staff) takes its kind of sample from any department, except where a culture of that
// department names the same kind (the dialysis unit's water is the dialysis unit's culture, not the network's).
export const roundMatches = (item: CultureItem, round: SamplingRound) => item.group
  ? item.sampleTypes.some((type: string) => round.types.has(type) && !(item.claimed || []).includes(`${round.department}|${type}`))
  : round.department === item.department && (!item.sampleTypes?.length || item.sampleTypes.some((type: string) => round.types.has(type)))

// The twelve months of a year for one culture: done (with its rounds), missed (due and past without a round), due (this
// month, not yet done), planned (ahead) or empty. A culture is due «every n months» after the last time it was done; with no
// round before the year, from January. Before the laboratory's first environmental sample (`start`) nothing is judged.
export function cultureYear(item: CultureItem, rounds: SamplingRound[], year: number, today = new Date(), start = ''): CultureMonth[] {
  const own = rounds.filter(round => roundMatches(item, round))
  const thisMonth = monthIndex(hospitalDate(today), year)
  const before = own.filter((round: SamplingRound) => monthIndex(round.day, year) < 0)
  let nextDue = before.length ? monthIndex(before[before.length - 1].day, year) + item.every : 0
  return Array.from({ length: 12 }, (_, month) => {
    const inMonth = own.filter((round: SamplingRound) => monthIndex(round.day, year) === month)
    if (inMonth.length) { nextDue = month + item.every; return { month, state: 'done', rounds: inMonth } }
    if (start && `${year}-${String(month + 1).padStart(2, '0')}` < start.slice(0, 7)) return { month, state: '', rounds: [] }
    if (month >= nextDue) {
      nextDue = month + item.every
      return { month, state: month < thisMonth ? 'missed' : month === thisMonth ? 'due' : 'planned', rounds: [] }
    }
    return { month, state: '', rounds: [] }
  })
}

// The rounds of a year that belong to no culture of the programme («out of programme»).
export const offProgramme = (items: CultureItem[], rounds: SamplingRound[], year: number) => rounds.filter((round: SamplingRound) => round.day.startsWith(String(year)) && !items.some((item: CultureItem) => roundMatches(item, round)))

// The programme's cultures from the controls: their department (the one sampled, else the assignment's) and kinds of sample.
// The cultures of a group come after the departments' ones.
export function cultureItems(definitions: CultureControl[] = []): CultureItem[] {
  const active = definitions.filter(row => row.category === CULTURE_CATEGORY && row.status !== 'archived')
  const own = active.filter(row => !CULTURE_GROUPS[row.cultureGroup])
    .flatMap(row => {
      const departments = row.cultureDepartment ? [row.cultureDepartment] : (row.departments || [])
      return departments.map((department: string) => ({ id: `${row.code}|${department}`, code: row.code, title: row.title, department, sampleTypes: row.cultureSampleTypes || [], every: everyMonths(row.frequency) }))
    })
    .sort((a, b) => a.department.localeCompare(b.department, 'el') || a.title.localeCompare(b.title, 'el'))
  const claimed = own.flatMap(item => item.sampleTypes.map((type: string) => `${item.department}|${type}`))
  const groups = active.filter(row => CULTURE_GROUPS[row.cultureGroup])
    .map(row => ({ id: `${row.code}|${row.cultureGroup}`, code: row.code, title: row.title, group: row.cultureGroup, department: '', sampleTypes: CULTURE_GROUPS[row.cultureGroup].types, claimed, every: everyMonths(row.frequency) }))
    .sort((a, b) => Object.keys(CULTURE_GROUPS).indexOf(a.group) - Object.keys(CULTURE_GROUPS).indexOf(b.group))
  return [...own, ...groups]
}
