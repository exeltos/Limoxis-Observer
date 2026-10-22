// Platform scope over several hospitals: add counts, merge breakdowns by key.
function mergePairs(lists) { const out = new Map(); for (const list of lists) for (const [key, ...values] of list || []) { const current = out.get(key) || values.map(() => 0); values.forEach((value, index) => { current[index] += Number(value) || 0 }); out.set(key, current) } return [...out.entries()].map(([key, values]) => [key, ...values]).sort((a, b) => b[1] - a[1]) }

// Historical hand-hygiene records used the verbose nursing label while the
// Management Center now uses the canonical "Νοσηλευτής/τρια" label. Treat
// those spellings as one category in analytics without rewriting audit/history data.
function normalizeHandHygieneCategory(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (/^Νοσηλευτής\s*\/\s*(?:Νοσηλεύτρια|τρια)$/iu.test(text)) return 'Νοσηλευτής/τρια'
  return text || '—'
}
function normalizeHandHygieneMetrics(metrics) {
  if (!metrics || !Array.isArray(metrics.byCategory)) return metrics
  const byCategory = mergePairs([
    metrics.byCategory.map(([key, ...values]) => [normalizeHandHygieneCategory(key), ...values]),
  ])
  return { ...metrics, byCategory }
}
function normalizeDomainItem(item) {
  if (!item?.handHygiene) return item
  return { ...item, handHygiene: normalizeHandHygieneMetrics(item.handHygiene) }
}

// Cross-tabulation cells ([row, column, count]): kept side by side, the matrix adds them up.
const CELL_KEYS = new Set(['haiByDepartment', 'organismByHaiType', 'deviceAssociated', 'byAgentDepartment', 'byAgentOrganism', 'findingsByControl', 'severityByDepartment'])
export function mergeDomainMetrics(list = []) {
  const items = list.filter(Boolean).map(normalizeDomainItem)
  if (!items.length) return null
  if (items.length === 1) return items[0]
  const merged = {}
  for (const section of ['surveillance', 'handHygiene', 'bundles', 'waste', 'controls', 'quality', 'antimicrobial', 'workforce', 'training', 'governance', 'pps', 'lira', 'qualityFood']) {
    const parts = items.map(item => item[section]).filter(Boolean)
    if (!parts.length) continue
    const result = {}
    for (const key of new Set(parts.flatMap(part => Object.keys(part)))) {
      const values = parts.map(part => part[key])
      if (CELL_KEYS.has(key)) result[key] = values.flatMap(value => (Array.isArray(value) ? value : []))
      else if (values.some(Array.isArray)) result[key] = mergePairs(values)
      else if (key === 'averageScore') { const weights = parts.map(part => Number(part.assessments ?? part.assignments) || 0), total = weights.reduce((a, b) => a + b, 0); result[key] = total ? Math.round(parts.reduce((sum, part, index) => sum + (Number(part.averageScore) || 0) * weights[index], 0) / total * 10) / 10 : null }
      else result[key] = values.reduce((sum, value) => sum + (Number(value) || 0), 0)
    }
    if (section === 'bundles') { result.byBundle = (result.byBundle || []).map(([key, n]) => [key, n, null]); result.byDepartment = (result.byDepartment || []).map(([key, n]) => [key, n, null]) }
    merged[section] = result
  }
  return merged
}
