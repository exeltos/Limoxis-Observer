// The Controls filters, applied once for every tab: each row keeps only the
// departments the filters leave, so the list, its KPIs, the adherence report,
// the calendar and every export count the same assignments. (A control kept
// for one department used to bring all its departments into adherence, the
// calendar and the exports.)
import { assignmentStatus, frequencyLabel } from './controlScheduling'
import { controlCriticality, criticalityLabel } from './controlCriticality'
import { ownerText } from '../employees/peopleOptions'

const ALL = 'all'

// The department, frequency, control type and criticality filters (the scope
// the KPIs count): rows with only their matching departments.
export function scopeControlRows(rows = [], { department = ALL, frequency = ALL, category = ALL, criticality = ALL } = {}) {
  return rows
    .filter(({ item }) => category === ALL || item.category === category)
    .filter(({ item }) => frequency === ALL || item.frequency?.kind === frequency)
    .filter(({ item }) => criticality === ALL || controlCriticality(item) === criticality)
    .map((row) => ({ ...row, departments: department === ALL ? row.departments : row.departments.filter((dep) => dep === department) }))
    .filter((row) => row.departments.length > 0)
}

// What the search box reads: the name, code, type, responsible, place and, since the
// list has no filters for them, the frequency and criticality as the user reads them (both languages).
export function controlSearchText(item) {
  const labels = ['el', 'en'].flatMap((language) => [frequencyLabel(item.frequency, language), criticalityLabel(controlCriticality(item), language)])
  return `${item.id} ${item.title} ${item.titleEn || ''} ${item.category} ${ownerText(item)} ${item.location || ''} ${item.equipment || ''} ${labels.join(' ')}`.toLowerCase()
}

// The scope, then the search and the status: a status keeps the departments in it.
export function filterControlRows(rows = [], { query = '', status = ALL, now = new Date(), ...scope } = {}) {
  const text = String(query || '').toLowerCase()
  return scopeControlRows(rows, scope)
    .filter(({ item }) => !text || controlSearchText(item).includes(text))
    .map((row) => {
      if (status === ALL) return row
      if (status === 'temporary') return { ...row, departments: row.departments.filter((dep) => Boolean(row.item.assignments?.[dep]?.hasDraft)) }
      return { ...row, departments: row.departments.filter((dep) => assignmentStatus(row.item, dep, now) === status) }
    })
    .filter((row) => row.departments.length > 0)
}
