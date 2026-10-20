import { deviceRuleKey } from '../../lira/liraHaiMetrics'
import { hospitalDay } from '../patientRecordScope'

// One vocabulary for every connected form of an episode: three plain words, never codes.
export const FORM_STATUS = Object.freeze({ PENDING: 'pending', DONE: 'done', OVERDUE: 'overdue' })

const athensFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Athens',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
})
function athensParts(date) {
  const parts = athensFormat.formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return { day: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) % 24 }
}
// Today in Europe/Athens (the repo rule for sample and admission dates), YYYY-MM-DD.
export const athensToday = (now = new Date()) => athensParts(now).day
export const athensHour = (now = new Date()) => athensParts(now).hour

export function addDays(day, count) {
  const value = new Date(`${String(day).slice(0, 10)}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}
export function daysBetween(from, to) {
  const a = Date.parse(`${String(from).slice(0, 10)}T12:00:00Z`)
  const b = Date.parse(`${String(to).slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null
}
// Day 1 is the day the device was inserted.
export function deviceDayNumber(insertedAt, today = athensToday()) {
  const inserted = hospitalDay(insertedAt)
  const diff = inserted ? daysBetween(inserted, today) : null
  return diff == null ? null : Math.max(1, diff + 1)
}
// The shift a check made now belongs to (the editor's own shift names).
export function shiftForHour(hour) {
  return hour >= 7 && hour < 15 ? 'Πρωινή' : hour >= 15 && hour < 23 ? 'Απογευματινή' : 'Νυχτερινή'
}

// The bundle a device type asks for: central line -> CLABSI, urinary catheter -> CAUTI,
// mechanical ventilation -> VAP (a library that only has VAE accepts it).
const BUNDLE_KEYS = { clabsi: ['CLABSI'], cauti: ['CAUTI'], vap: ['VAP', 'VAE'] }
export function bundleKeysForDevice(device) {
  const text = `${device?.name || device?.type || ''} ${device?.nameEn || ''}`
  // An endotracheal tube is the airway of a ventilated patient.
  const key = deviceRuleKey(text) || (/ενδοτραχει|endotracheal|intubat/i.test(text) ? 'vap' : null)
  return key ? BUNDLE_KEYS[key] : []
}
export const isActiveDevice = device => Boolean(device) && !device.removedAt && device.status !== 'removed'

function yesCount(row) {
  const answers = row?.answers && typeof row.answers === 'object' ? row.answers : {}
  const values = Object.values(answers)
  return { yes: values.filter(x => x === 'yes').length, applicable: values.filter(x => x === 'yes' || x === 'no').length }
}

// Status of the daily check of one device. Computed, never stored: done = a completed check
// today; overdue = the day after the last check (or the insertion day) has passed; else pending.
export function bundleStatusForDevice({ device, assessments = [], today = athensToday() }) {
  const own = assessments
    .filter(row => row.status !== 'cancelled' && String(row.surveillanceDeviceId || '') === String(device.id))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const completed = own.filter(row => row.status === 'completed')
  const last = own[0] || null
  const lastCompleted = completed[0] || null
  const lastDay = lastCompleted ? hospitalDay(lastCompleted.date) : null
  const insertedDay = hospitalDay(device.insertedAt || device.startedAt)
  const dueOn = lastDay ? addDays(lastDay, 1) : insertedDay || today
  const status = lastDay && lastDay >= today ? FORM_STATUS.DONE : dueOn < today ? FORM_STATUS.OVERDUE : FORM_STATUS.PENDING
  const counts = yesCount(last)
  return {
    status,
    dueOn,
    deviceDay: deviceDayNumber(device.insertedAt || device.startedAt, today),
    bundleKeys: bundleKeysForDevice(device),
    last,
    lastDate: last ? hospitalDay(last.date) : null,
    compliance: last && last.score != null ? Math.round(Number(last.score)) : null,
    yes: counts.yes,
    applicable: counts.applicable,
    history: own,
  }
}
