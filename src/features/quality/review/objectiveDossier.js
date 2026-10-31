import { formatDay } from '../../../core/i18n/formatDay'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { loadEntries } from '../../registers/registerService'
import { monthlySeries, textOf } from '../../registers/registerEngine'
import { formatObjectiveValue, objectiveState } from './reviewTemplate'
import { objectiveStateLabel, objectiveTitle } from './QualityObjectives'

// The year's objectives as a file for the auditor (ISO 9001 §6.2 and §9.3): each objective with its owner and date, how it is measured,
// its value month by month with a chart and its status, then what the last management review decided.
const monthName = (year, month, en) => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
const sign = objective => (objective.direction === 'lower' ? '≤' : '≥')

// The months of the year so far, with the value, for the objectives measured by a register's indicator.
export async function loadObjectiveHistories(organizationId, objectives) {
  const histories = new Map()
  const byRegister = new Map()
  for (const objective of objectives || []) if (objective.register && objective.indicator) byRegister.set(objective.register.id, objective.register)
  const entries = new Map(await Promise.all([...byRegister.values()].map(async register => [register.id, await loadEntries(organizationId, register.id, { register }).catch(() => [])])))
  const now = new Date()
  for (const objective of objectives || []) {
    if (!objective.register || !objective.indicator) continue
    const last = objective.year < now.getFullYear() ? 12 : objective.year > now.getFullYear() ? 0 : now.getMonth() + 1
    histories.set(objective.id, monthlySeries(objective.register, objective.indicator, entries.get(objective.register.id) || [], objective.year).filter(row => row.month <= last && row.value != null))
  }
  return histories
}

// The chart of the months as inline SVG (a document has no scripts): the line, the target dashed, the last point marked.
export function historyChartHtml(objective, history, language) {
  if (!history || history.length < 2) return ''
  const width = 560, height = 110, pad = 8
  const target = Number.isFinite(Number(objective.target)) && objective.target !== '' ? Number(objective.target) : null
  const values = [...history.map(row => Number(row.value)), ...(target == null ? [] : [target])]
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const x = index => pad + (index * (width - pad * 2)) / Math.max(1, history.length - 1)
  const y = value => pad + (1 - (Number(value) - min) / span) * (height - pad * 2)
  const line = history.map((row, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ')
  const last = history.length - 1
  const caption = language === 'en' ? 'Value by month' : 'Τιμή ανά μήνα'
  return `<figure style="margin:6px 0"><figcaption style="font-size:8pt;color:#5d7083;text-transform:uppercase">${caption}</figcaption><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${caption}">${target == null ? '' : `<line x1="${pad}" x2="${width - pad}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" stroke="#9aa9b8" stroke-dasharray="4 3"/>`}<path d="${line}" fill="none" stroke="#2f5f9e" stroke-width="2"/><circle cx="${x(last).toFixed(1)}" cy="${y(history[last].value).toFixed(1)}" r="3.5" fill="#fff" stroke="#2f5f9e" stroke-width="2"/></svg></figure>`
}

// One objective's section: the facts, the chart and the months.
export function objectiveSection(objective, history, language) {
  const en = language === 'en'
  const unit = objective.unit
  const state = objective.current.status
  return {
    title: `${objective.code} · ${objectiveTitle(objective, language)}`,
    facts: [
      [en ? 'Measured by' : 'Μετριέται με', objective.indicator ? `${textOf(objective.indicator, language)} (${en ? objective.register.nameEn || objective.register.name : objective.register.name})` : (en ? 'Value reported by the owner' : 'Τιμή από τον υπεύθυνο')],
      [en ? 'Target' : 'Στόχος', `${sign(objective)} ${formatObjectiveValue(objective.target, unit, language)}`],
      [en ? 'Value today' : 'Τιμή σήμερα', formatObjectiveValue(objective.current.value, unit, language)],
      [en ? 'Status' : 'Κατάσταση', objectiveStateLabel(state, en)],
      [en ? 'Owner' : 'Υπεύθυνος', roleTitleText(objective.ownerLabel, language) || '—'],
      [en ? 'Due' : 'Προθεσμία', objective.dueDate ? formatDay(objective.dueDate, language) : '—'],
    ],
    html: historyChartHtml(objective, history, language),
    table: history?.length ? { columns: [en ? 'Month' : 'Μήνας', en ? 'Value' : 'Τιμή', en ? 'Status' : 'Κατάσταση'], rows: history.map(row => [monthName(objective.year, row.month, en), formatObjectiveValue(row.value, unit, language), { text: objectiveStateLabel(objectiveState(objective, row.value), en), className: objectiveState(objective, row.value) === 'missed' ? 'rd-bad' : 'rd-good' }]) } : null,
  }
}

// The whole file of one year: summary, the objectives table, every objective, the last management review's decisions.
export function objectivesDossier({ objectives, histories, reviews, year, language }) {
  const en = language === 'en'
  const rows = (objectives || []).filter(objective => objective.year === year)
  const count = status => rows.filter(objective => objective.current.status === status).length
  const review = [...(reviews || [])].filter(item => item.status !== 'draft').sort((a, b) => String(b.reviewDate).localeCompare(String(a.reviewDate)))[0] || null
  return {
    language,
    kind: en ? 'Quality objectives file' : 'Φάκελος στοχοθεσίας ποιότητας',
    code: String(year),
    title: en ? `Quality objectives ${year}` : `Στόχοι ποιότητας ${year}`,
    subtitle: en ? 'For the auditor: the objectives, how each is measured, who owns it, its value over time and the management review.' : 'Για τον επιθεωρητή: οι στόχοι, πώς μετριέται ο καθένας, ποιος τον υπηρετεί, η τιμή του στον χρόνο και η ανασκόπηση της διοίκησης.',
    meta: [[en ? 'Objectives' : 'Στόχοι', String(rows.length)], [en ? 'Met' : 'Επιτυγχάνονται', String(count('met'))], [en ? 'Not met' : 'Δεν επιτυγχάνονται', String(count('missed'))], [en ? 'No value yet' : 'Χωρίς τιμή ακόμα', String(count('pending'))]],
    sections: [
      { title: en ? 'The objectives' : 'Οι στόχοι', table: { columns: [en ? 'Objective' : 'Στόχος', en ? 'Target' : 'Στόχος (τιμή)', en ? 'Value' : 'Τιμή', en ? 'Owner' : 'Υπεύθυνος', en ? 'Due' : 'Προθεσμία', en ? 'Status' : 'Κατάσταση'], rows: rows.map(objective => [`${objective.code} · ${objectiveTitle(objective, language)}`, `${sign(objective)} ${formatObjectiveValue(objective.target, objective.unit, language)}`, formatObjectiveValue(objective.current.value, objective.unit, language), roleTitleText(objective.ownerLabel, language) || '—', objective.dueDate ? formatDay(objective.dueDate, language) : '—', { text: objectiveStateLabel(objective.current.status, en), className: objective.current.status === 'missed' ? 'rd-bad' : objective.current.status === 'met' ? 'rd-good' : '' }]) } },
      ...rows.map(objective => objectiveSection(objective, histories?.get(objective.id), language)),
      review ? { title: en ? `Management review ${review.code}` : `Ανασκόπηση διοίκησης ${review.code}`, text: `${formatDay(review.reviewDate, language)}${review.summary ? `\n\n${review.summary}` : ''}`, table: review.actions?.length ? { columns: [en ? 'Decision' : 'Απόφαση', en ? 'Owner' : 'Υπεύθυνος', en ? 'Due' : 'Προθεσμία', en ? 'Status' : 'Κατάσταση'], rows: review.actions.map(action => [action.title, roleTitleText(action.ownerLabel, language) || '—', action.dueDate ? formatDay(action.dueDate, language) : '—', action.status]) } : null } : { title: en ? 'Management review' : 'Ανασκόπηση διοίκησης', text: en ? 'No management review has been recorded yet.' : 'Δεν έχει καταγραφεί ακόμη ανασκόπηση διοίκησης.' },
    ],
    signatures: [en ? 'Prepared by' : 'Συντάχθηκε από', en ? 'Approved by' : 'Εγκρίθηκε από'],
    filename: `${en ? 'quality-objectives' : 'stoxoi-poiotitas'}-${year}`,
  }
}
