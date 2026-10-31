// Outbreak/cluster early-warning signal (platform review roadmap, P2).
// Detects the tightest run of same-organism, same-department positive
// isolates within a rolling window, anywhere in the retained history —
// not just "in the last N days from now" — so a genuine cluster stays
// visible regardless of how much wall-clock time has passed since it
// occurred (the same reason CDC/state-health cluster algorithms look for
// the tightest interval between cases rather than a fixed lookback from
// query time). `lastEventDate` lets a caller judge staleness separately.
import { isSkinFloraOrganism } from './skinFloraOrganisms'

const DAY_MS = 86400000

function normalizeOrganism(value) {
  return String(value || '').trim().toLowerCase()
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

// Skin flora / contaminants (see skinFloraOrganisms.js) count only patients with 2+ distinct
// positive samples inside the window, and the count is then of patients, not isolates.
function skinFloraWindow(items, i, j) {
  const perPatient = new Map()
  items.slice(i, j + 1).forEach((item, index) => {
    const patient = item.patientId || item.sampleId || `row-${index}`
    if (!perPatient.has(patient)) perPatient.set(patient, { samples: new Set(), items: [] })
    const entry = perPatient.get(patient)
    entry.samples.add(item.sampleId || `row-${index}`)
    entry.items.push(item)
  })
  const kept = [...perPatient.values()].filter(entry => entry.samples.size >= 2)
  const keptItems = kept.flatMap(entry => entry.items).sort((a, b) => a.date.localeCompare(b.date))
  return { count: kept.length, items: keptItems }
}

// records: [{organism, department, date /* 'YYYY-MM-DD' */, resistance?, patientId?, sampleId?}]
export function detectOrganismClusters(records, { windowDays = 14, threshold = 3 } = {}) {
  const groups = new Map()
  for (const record of records || []) {
    if (!record?.organism || !record?.department || !record?.date) continue
    const key = `${record.department}|||${normalizeOrganism(record.organism)}`
    if (!groups.has(key)) groups.set(key, { department: record.department, organism: record.organism, items: [] })
    groups.get(key).items.push({ date: String(record.date).slice(0, 10), resistance: record.resistance || null, patientId: record.patientId || null, sampleId: record.sampleId || null })
  }

  const clusters = []
  for (const group of groups.values()) {
    const sorted = [...group.items].sort((a, b) => a.date.localeCompare(b.date))
    let best = null
    const skinFlora = isSkinFloraOrganism(group.organism)
    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = addDays(sorted[i].date, windowDays)
      let j = i
      while (j + 1 < sorted.length && sorted[j + 1].date <= windowEnd) j++
      let count = j - i + 1
      let items = sorted.slice(i, j + 1)
      if (skinFlora) ({ count, items } = skinFloraWindow(sorted, i, j))
      if (count >= threshold && (!best || count > best.count)) {
        best = { count, firstDate: items[0].date, lastDate: items[items.length - 1].date, items }
      }
    }
    if (!best) continue
    clusters.push({
      department: group.department,
      organism: group.organism,
      count: best.count,
      patientCount: new Set(best.items.map(x => x.patientId).filter(Boolean)).size || best.count,
      sampleCount: best.items.length,
      windowDays,
      firstDate: best.firstDate,
      lastDate: best.lastDate,
      resistanceLabels: [...new Set(best.items.map(x => x.resistance).filter(Boolean))],
      lastEventDate: sorted[sorted.length - 1].date,
      skinFloraRule: skinFlora,
    })
  }
  return clusters.sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
}

export function clusterAlertId(cluster) {
  return `CLUSTER-${cluster.department}-${normalizeOrganism(cluster.organism)}-${cluster.firstDate}`.replace(/\s+/g, '_')
}
