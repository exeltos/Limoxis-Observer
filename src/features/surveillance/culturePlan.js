// The culture programme (Surveillance › Culture programme): which environmental cultures are due when, per department, and
// which were done — read from the laboratory's environmental samples (department + kind of sample), never entered twice.

export const CULTURE_CATEGORY = 'Περιβαλλοντικός μικροβιολογικός έλεγχος'

// Every how many months a culture is due, from its frequency (monthly every n; yearly; anything more often counts monthly).
export function everyMonths(frequency = {}) {
  const interval = Math.max(1, Number(frequency?.interval) || 1)
  if (frequency?.kind === 'yearly') return 12 * interval
  if (frequency?.kind === 'monthly') return interval
  return 1
}

const dayOf = value => String(value || '').slice(0, 10)
const monthIndex = (day, year) => (Number(day.slice(0, 4)) - year) * 12 + Number(day.slice(5, 7)) - 1

// The sampling rounds: the environmental samples of one department on one day.
export function samplingRounds(samples = []) {
  const rounds = new Map()
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
export const roundMatches = (item, round) => round.department === item.department && (!item.sampleTypes?.length || item.sampleTypes.some(type => round.types.has(type)))

// The twelve months of a year for one culture: done (with its rounds), missed (due and past without a round), due (this
// month, not yet done), planned (ahead) or empty. A culture is due «every n months» after the last time it was done; with no
// round before the year, from January. Before the laboratory's first environmental sample (`start`) nothing is judged.
export function cultureYear(item, rounds, year, today = new Date(), start = '') {
  const own = rounds.filter(round => roundMatches(item, round))
  const thisMonth = monthIndex(today.toISOString().slice(0, 10), year)
  const before = own.filter(round => monthIndex(round.day, year) < 0)
  let nextDue = before.length ? monthIndex(before[before.length - 1].day, year) + item.every : 0
  return Array.from({ length: 12 }, (_, month) => {
    const inMonth = own.filter(round => monthIndex(round.day, year) === month)
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
export const offProgramme = (items, rounds, year) => rounds.filter(round => round.day.startsWith(String(year)) && !items.some(item => roundMatches(item, round)))

// The programme's cultures from the controls: their department (the one sampled, else the assignment's) and kinds of sample.
export function cultureItems(definitions = []) {
  return definitions
    .filter(row => row.category === CULTURE_CATEGORY && row.status !== 'archived')
    .flatMap(row => {
      const departments = row.cultureDepartment ? [row.cultureDepartment] : (row.departments || [])
      return departments.map(department => ({ id: `${row.code}|${department}`, code: row.code, title: row.title, department, sampleTypes: row.cultureSampleTypes || [], every: everyMonths(row.frequency) }))
    })
    .sort((a, b) => a.department.localeCompare(b.department, 'el') || a.title.localeCompare(b.title, 'el'))
}
