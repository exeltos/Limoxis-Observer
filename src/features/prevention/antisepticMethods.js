export const ANTISEPTIC_METHODS = [
  {
    id: 'pharmacy_issue',
    label: 'Χορήγηση / διάθεση από Φαρμακείο',
    labelEn: 'Issue / supply from Pharmacy',
  },
  { id: 'warehouse_issue', label: 'Διάθεση από Αποθήκη', labelEn: 'Issue from Warehouse' },
  { id: 'stock_difference', label: 'Διαφορά αποθέματος', labelEn: 'Stock difference' },
  {
    id: 'direct_measurement',
    label: 'Άμεση μέτρηση κατανάλωσης',
    labelEn: 'Direct consumption measurement',
  },
  { id: 'other', label: 'Άλλη τεκμηριωμένη πηγή', labelEn: 'Other documented source' },
]

export function isAbhrProduct(product) {
  if (!product) return false
  if (typeof product === 'object')
    return (
      product.indicatorEligible === true ||
      product.metadata?.is_abhr === true ||
      product.code === 'ANT-ABHR' ||
      product.productCode === 'ANT-ABHR'
    )
  return String(product).trim() === 'ANT-ABHR'
}

export function antisepticMethodLabel(id, language = 'el') {
  const item = ANTISEPTIC_METHODS.find(x => x.id === id)
  return item ? (language === 'en' ? item.labelEn : item.label) : id || '—'
}

// The reporting period of a consumption record: «YYYY-MM» (a month) or «YYYY-MM – YYYY-MM»
// (a stretch of months, January to December being a whole year).
const PERIOD = /^(\d{4})-(\d{2})(?:\s*[–-]\s*(\d{4})-(\d{2}))?$/

// 'month' | 'year' | 'range' (any other stretch) | '' (not a period).
export function antisepticPeriodKind(period) {
  const match = PERIOD.exec(String(period || '').trim())
  if (!match) return ''
  if (!match[3] || (match[1] === match[3] && match[2] === match[4])) return 'month'
  return match[1] === match[3] && match[2] === '01' && match[4] === '12' ? 'year' : 'range'
}

// First and last day of the period.
export function antisepticPeriodBounds(period) {
  const match = PERIOD.exec(String(period || '').trim())
  if (!match) return null
  const startYear = Number(match[1])
  const startMonth = Number(match[2])
  const endYear = Number(match[3] || match[1])
  const endMonth = Number(match[4] || match[2])
  const last = new Date(endYear, endMonth, 0).getDate()
  const pad = value => String(value).padStart(2, '0')
  return { from: `${startYear}-${pad(startMonth)}-01`, to: `${endYear}-${pad(endMonth)}-${pad(last)}` }
}

// «03/2026», «2025» for a whole year, «01/2025 – 06/2025» for another stretch.
export function antisepticPeriodLabel(period) {
  const match = PERIOD.exec(String(period || '').trim())
  if (!match) return period || '—'
  const kind = antisepticPeriodKind(period)
  if (kind === 'year') return match[1]
  if (kind === 'month') return `${match[2]}/${match[1]}`
  return `${match[2]}/${match[1]} – ${match[4]}/${match[3]}`
}
