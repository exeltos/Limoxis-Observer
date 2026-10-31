export function wasteCategoryTone(value = '') {
  const code = String(value).trim().toUpperCase()
  if (code === 'ΕΑΑΜ') return 'eaam'
  if (code === 'ΜΕΑ') return 'mea'
  if (code === 'ΑΕΑ') return 'aea'
  return 'other'
}

// A waste measurement covers a period: a whole calendar month reads as «10/2026»
// (its end date can still be ahead), any other span by its dates, a single day by its date.
export function wastePeriodLabel(row, fmtDate) {
  const start = String(row?.periodStart || '').slice(0, 10)
  const end = String(row?.periodEnd || '').slice(0, 10)
  if (start && end && start.endsWith('-01') && start.slice(0, 7) === end.slice(0, 7)) {
    const [year, month] = start.split('-').map(Number)
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (Number(end.slice(8, 10)) === last) return `${String(month).padStart(2, '0')}/${year}`
  }
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`
  return fmtDate(row?.date || start)
}
