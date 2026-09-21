// Outbreak/cluster early-warning signal (platform review roadmap, P2).
// Detects the tightest run of same-organism, same-department positive
// isolates within a rolling window, anywhere in the retained history —
// not just "in the last N days from now" — so a genuine cluster stays
// visible regardless of how much wall-clock time has passed since it
// occurred (the same reason CDC/state-health cluster algorithms look for
// the tightest interval between cases rather than a fixed lookback from
// query time). `lastEventDate` lets a caller judge staleness separately.
const DAY_MS = 86400000

function normalizeOrganism(value) {
  return String(value || '').trim().toLowerCase()
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

// records: [{organism, department, date /* 'YYYY-MM-DD' */, resistance?}]
export function detectOrganismClusters(records, { windowDays = 14, threshold = 3 } = {}) {
  const groups = new Map()
  for (const record of records || []) {
    if (!record?.organism || !record?.department || !record?.date) continue
    const key = `${record.department}|||${normalizeOrganism(record.organism)}`
    if (!groups.has(key)) groups.set(key, { department: record.department, organism: record.organism, items: [] })
    groups.get(key).items.push({ date: String(record.date).slice(0, 10), resistance: record.resistance || null })
  }

  const clusters = []
  for (const group of groups.values()) {
    const sorted = [...group.items].sort((a, b) => a.date.localeCompare(b.date))
    let best = null
    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = addDays(sorted[i].date, windowDays)
      let j = i
      while (j + 1 < sorted.length && sorted[j + 1].date <= windowEnd) j++
      const count = j - i + 1
      if (count >= threshold && (!best || count > best.count)) {
        best = { count, firstDate: sorted[i].date, lastDate: sorted[j].date, items: sorted.slice(i, j + 1) }
      }
    }
    if (!best) continue
    clusters.push({
      department: group.department,
      organism: group.organism,
      count: best.count,
      windowDays,
      firstDate: best.firstDate,
      lastDate: best.lastDate,
      resistanceLabels: [...new Set(best.items.map(x => x.resistance).filter(Boolean))],
      lastEventDate: sorted[sorted.length - 1].date,
    })
  }
  return clusters.sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
}

export function clusterAlertId(cluster) {
  return `CLUSTER-${cluster.department}-${normalizeOrganism(cluster.organism)}-${cluster.firstDate}`.replace(/\s+/g, '_')
}
