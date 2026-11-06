// The printouts of the incident register (printReport): the register itself, grouped as asked, and its statistics.
import { REPORT_KINDS, incidentCategoryLabel, vocabularyLabel } from './qualityVocabulary'
import { stageLabel } from './QualityReportRegister'

const dmy = value => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '')
const MONTHS = {
  el: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const mid = text => ({ text, align: 'center' })
const isOpen = row => !['closed', 'voided'].includes(row.stage)

function labels(language, categories) {
  const en = language === 'en'
  return {
    en,
    kind: row => vocabularyLabel(REPORT_KINDS, row.kind, language) || '',
    category: row => incidentCategoryLabel(row.category, categories, language) || '',
    department: row => (en ? row.departmentEn : row.department) || (en ? 'No department' : 'Χωρίς τμήμα'),
    title: row => (en ? row.titleEn : row.title) || '',
    month: row => { const d = String(row.date || '').slice(0, 7); return d ? `${MONTHS[en ? 'en' : 'el'][Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '—' },
  }
}

function totalsMeta(rows, period, en) {
  return [
    ...(period ? [[en ? 'Period' : 'Περίοδος', period]] : []),
    [en ? 'Incidents' : 'Συμβάντα', String(rows.length)],
    [en ? 'Open / closed' : 'Ανοιχτά / κλειστά', `${rows.filter(isOpen).length} / ${rows.filter(row => row.stage === 'closed').length}`],
    [en ? 'Sentinel events' : 'Συμβάντα-φρουροί', String(rows.filter(row => row.sentinel).length)],
  ]
}

// «Μητρώο συμβάντων»: one table, or one per department, kind or month.
export function incidentRegisterDoc({ rows, groupBy = 'none', language = 'el', categories = [], period = '' }) {
  const L = labels(language, categories), en = L.en
  const columns = [
    { text: en ? 'Code' : 'Κωδικός', width: '13%' },
    { text: en ? 'Date' : 'Ημερομηνία', width: '9%', align: 'center' },
    { text: en ? 'Title' : 'Τίτλος', width: '27%' },
    { text: en ? 'Kind' : 'Είδος', width: '12%' },
    { text: en ? 'Category' : 'Κατηγορία', width: '14%' },
    ...(groupBy === 'department' ? [] : [{ text: en ? 'Department' : 'Τμήμα', width: '13%' }]),
    { text: en ? 'Stage' : 'Στάδιο', width: '12%' },
  ]
  const line = row => [row.code + (row.sentinel ? ' · Sentinel' : ''), mid(dmy(row.date)), L.title(row), L.kind(row), L.category(row), ...(groupBy === 'department' ? [] : [L.department(row)]), stageLabel(row.stage, language)]
  const sorted = [...rows].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const keyOf = { department: L.department, kind: L.kind, month: row => String(row.date || '').slice(0, 7) }[groupBy]
  const groups = new Map()
  for (const row of sorted) { const key = keyOf ? keyOf(row) : ''; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row) }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'el'))
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title: en ? 'Incident register' : 'Μητρώο συμβάντων',
    filename: en ? 'incident-register' : 'mitroo-symvanton',
    meta: totalsMeta(rows, period, en),
    sections: keys.map(key => ({
      title: groupBy === 'none' ? '' : `${groupBy === 'month' ? L.month(groups.get(key)[0]) : key} · ${groups.get(key).length}`,
      table: { columns, rows: groups.get(key).map(line) },
    })),
  }
}

// «Στατιστικά συμβάντων»: how many per kind and month, per department and per category.
export function incidentStatisticsDoc({ rows, language = 'el', categories = [], period = '' }) {
  const L = labels(language, categories), en = L.en
  const count = (list, of) => { const map = new Map(); for (const row of list) { const key = of(row) || '—'; map.set(key, (map.get(key) || 0) + 1) } return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el')) }
  const months = [...new Set(rows.map(row => String(row.date || '').slice(0, 7)).filter(Boolean))].sort()
  const kinds = [...new Set(rows.map(L.kind))].sort((a, b) => a.localeCompare(b, 'el'))
  const share = n => (rows.length ? `${Math.round((n / rows.length) * 100)}%` : '')
  const byGroup = (title, of) => {
    const list = count(rows, of)
    return { title, table: { columns: [{ text: title, width: '55%' }, { text: en ? 'Incidents' : 'Συμβάντα', width: '15%', align: 'center' }, { text: en ? 'Open' : 'Ανοιχτά', width: '15%', align: 'center' }, { text: '%', width: '15%', align: 'center' }], rows: list.map(([key, n]) => [key, mid(String(n)), mid(String(rows.filter(row => (of(row) || '—') === key && isOpen(row)).length)), mid(share(n))]) } }
  }
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title: en ? 'Incident statistics' : 'Στατιστικά συμβάντων',
    filename: en ? 'incident-statistics' : 'statistika-symvanton',
    meta: totalsMeta(rows, period, en),
    sections: [
      {
        title: en ? 'By month and kind' : 'Ανά μήνα και είδος',
        table: {
          columns: [{ text: en ? 'Month' : 'Μήνας', width: '22%' }, ...kinds.map(kind => ({ text: kind, align: 'center' })), { text: en ? 'Total' : 'Σύνολο', align: 'center' }],
          rows: months.map(month => { const list = rows.filter(row => String(row.date || '').slice(0, 7) === month); return [L.month(list[0]), ...kinds.map(kind => mid(String(list.filter(row => L.kind(row) === kind).length || ''))), mid(String(list.length))] }),
          foot: [en ? 'Total' : 'Σύνολο', ...kinds.map(kind => mid(String(rows.filter(row => L.kind(row) === kind).length))), mid(String(rows.length))],
        },
      },
      byGroup(en ? 'Department' : 'Τμήμα', L.department),
      byGroup(en ? 'Category' : 'Κατηγορία', L.category),
    ],
  }
}
