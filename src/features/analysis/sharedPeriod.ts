// One period for the Executive dashboard and Analysis: the current calendar
// year by default, and whatever the viewer picks on one page is where the
// other opens (for this browser tab). Stored in the Executive's shape
// ({period, from, to}); Analysis maps it to its year / breakdown / slot.
import { readSessionJson, writeSessionJson } from '../../core/storage/browserStorage'
import { calendarRange } from './analysisPageModel'

const KEY = 'lo.period.shared'
export const SHARED_PERIOD_DEFAULT = Object.freeze({ period: 'year', from: '', to: '' })
const PRESETS = ['month', '3m', '6m', '12m', 'year', 'custom']

export function readSharedPeriod() {
  const value = readSessionJson(KEY, null)
  if (!value || !PRESETS.includes(value.period)) return SHARED_PERIOD_DEFAULT
  return { period: value.period, from: value.from || '', to: value.to || '' }
}
export function writeSharedPeriod({ period, from = '', to = '' }) {
  if (!PRESETS.includes(period)) return
  writeSessionJson(KEY, period === 'custom' ? { period, from, to } : { period, from: '', to: '' })
}

const SLOTS = { year: [1], half: [1, 2], quarter: [1, 2, 3, 4], month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }

// The shared period as Analysis's {year, periodType, periodSlot}; a span
// Analysis cannot show (the last 3/6/12 months) opens on the current year.
export function analysisPeriodOf(shared = SHARED_PERIOD_DEFAULT, today = new Date()) {
  const year = String(today.getFullYear())
  if (shared.period === 'month') return { year, periodType: 'month', periodSlot: String(today.getMonth() + 1) }
  if (shared.period === 'custom' && shared.from && shared.to) {
    const y = shared.from.slice(0, 4)
    for (const [periodType, slots] of Object.entries(SLOTS)) for (const slot of slots) {
      const range = calendarRange(y, periodType, String(slot))
      if (range.from === shared.from && range.to === shared.to) return { year: y, periodType, periodSlot: String(slot) }
    }
  }
  return { year, periodType: 'year', periodSlot: '1' }
}
// Analysis's choice back in the shared shape.
export function sharedPeriodOfAnalysis(year, periodType, periodSlot, today = new Date()) {
  const current = String(year) === String(today.getFullYear())
  if (periodType === 'year' && current) return { period: 'year', from: '', to: '' }
  if (periodType === 'month' && current && Number(periodSlot) === today.getMonth() + 1) return { period: 'month', from: '', to: '' }
  const range = calendarRange(year, periodType, periodSlot)
  return { period: 'custom', from: range.from, to: range.to }
}

const MONTHS = { el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
const lastDay = (y, m) => new Date(Number(y), Number(m), 0).getDate()
const dmy = value => { const [y, m, d] = String(value || '').split('-'); return y && m && d ? `${d}/${m}/${y}` : '—' }

// The short period shown next to each measure: «2026 · έτος», «Οκτ 2026 · μήνας»,
// «Q3 2026 · τρίμηνο», «Τελευταίοι 3 μήνες», or the dates.
export function periodTag({ from, to } = {}, en = false, period = '') {
  const tx = (el, enText) => (en ? enText : el)
  if (period === '3m' || period === '6m' || period === '12m') { const n = period.replace('m', ''); return tx(`Τελευταίοι ${n} μήνες`, `Last ${n} months`) }
  if (!from || !to) return ''
  const [fy, fm, fd] = from.split('-').map(Number), [ty, tm, td] = to.split('-').map(Number)
  if (fy === ty && fd === 1) {
    const toEnd = td === lastDay(ty, tm)
    if (fm === 1 && (period === 'year' || (tm === 12 && toEnd))) return `${fy} · ${tx('έτος', 'year')}`
    if (fm === tm && (period === 'month' || toEnd)) return `${MONTHS[en ? 'en' : 'el'][fm - 1]} ${fy} · ${tx('μήνας', 'month')}`
    if (toEnd && tm - fm === 2 && fm % 3 === 1) return `Q${(fm + 2) / 3} ${fy} · ${tx('τρίμηνο', 'quarter')}`
    if (toEnd && tm - fm === 5 && (fm === 1 || fm === 7)) return en ? `H${fm === 1 ? 1 : 2} ${fy} · half` : `${fm === 1 ? 'Α΄' : 'Β΄'} εξάμηνο ${fy}`
  }
  return `${dmy(from)} – ${dmy(to)}`
}
