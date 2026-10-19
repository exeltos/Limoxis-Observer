// An AMR classification's calculation (mechanism, how many antimicrobial
// categories were tested, which were susceptible / non-susceptible) is stored
// in columns and amr_classification_categories rows; screens keep reading it
// as one calculationSnapshot object.
export const AMR_CATEGORY_SELECT =
  'categories:amr_classification_categories(susceptible,position,category)'

const byPosition = (a, b) => (a.position || 0) - (b.position || 0)

export function amrCalculationSnapshot(row = {}) {
  const categories = [...(row.categories || [])].sort(byPosition)
  const susceptible = categories.filter(item => item.susceptible).map(item => item.category)
  const nonSusceptible = categories.filter(item => !item.susceptible).map(item => item.category)
  if (!row.mechanism && row.categories_tested == null && !categories.length) return {}
  return {
    ...(row.mechanism ? { mechanism: row.mechanism } : {}),
    ...(row.categories_tested != null ? { categoriesTested: row.categories_tested } : {}),
    susceptibleCategories: susceptible,
    nonSusceptibleCategories: nonSusceptible,
  }
}

// The columns and category rows of a calculation snapshot draft.
export function amrCalculationColumns(snapshot = {}) {
  const tested = Number(snapshot?.categoriesTested)
  return {
    mechanism: String(snapshot?.mechanism || '').trim() || null,
    categories_tested: Number.isInteger(tested) && tested >= 0 ? tested : null,
  }
}

export function amrCategoryRows(snapshot = {}) {
  const rows = []
  for (const [list, susceptible] of [
    [snapshot?.susceptibleCategories, true],
    [snapshot?.nonSusceptibleCategories, false],
  ]) {
    ;(Array.isArray(list) ? list : [])
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .forEach((category, index) => rows.push({ susceptible, position: index + 1, category }))
  }
  return rows
}
