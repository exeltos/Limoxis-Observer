// The printout of the deviations (printReport): one table, or one per department, kind or month; the figures of
// the period on top (how many, open, without action, recurring, the commonest causes).
import { CAUSE_CATEGORIES, DEVIATION_KINDS, causeCategoriesText, vocabularyLabel } from './qualityVocabulary'

const dmy = value => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '')
const mid = text => ({ text, align: 'center' })

export function deviationsReportDoc({ rows, groupBy = 'none', language = 'el', t = value => value, period = '' }) {
  const en = language === 'en'
  const title = row => (en ? row.titleEn : row.title) || row.title || ''
  const department = row => (en ? row.departmentEn : row.department) || row.department || (en ? 'No department' : 'Χωρίς τμήμα')
  const kind = row => (row.deviationKind ? vocabularyLabel(DEVIATION_KINDS, row.deviationKind, language) : (en ? 'No kind' : 'Χωρίς είδος'))
  const month = row => String(row.date || '').slice(0, 7)
  const monthName = key => (key ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }).format(new Date(`${key}-15T12:00:00Z`)) : (en ? 'No date' : 'Χωρίς ημερομηνία'))
  const keyOf = { department, kind, month }[groupBy]
  const columns = [
    { text: en ? 'Code' : 'Κωδικός', width: '12%' },
    { text: en ? 'Date' : 'Ημερομηνία', width: '8%', align: 'center' },
    { text: en ? 'Deviation' : 'Απόκλιση', width: ['kind', 'department'].includes(groupBy) ? '38%' : '27%' },
    ...(groupBy === 'kind' ? [] : [{ text: en ? 'Kind' : 'Είδος', width: '11%' }]),
    ...(groupBy === 'department' ? [] : [{ text: en ? 'Department' : 'Τμήμα', width: '11%' }]),
    { text: en ? 'Causes' : 'Αιτίες', width: '13%' },
    { text: en ? 'Responsible' : 'Υπεύθυνος', width: '10%' },
    { text: en ? 'Status' : 'Κατάσταση', width: '8%' },
  ]
  const line = row => [
    row.code, mid(dmy(row.date)), title(row) + (row.recurring ? (en ? ' (recurring)' : ' (επαναλαμβανόμενη)') : ''),
    ...(groupBy === 'kind' ? [] : [row.deviationKind ? kind(row) : '']),
    ...(groupBy === 'department' ? [] : [department(row)]),
    causeCategoriesText(row.causeCategories || [], language), row.owner || '', t(row.status),
  ]
  const sorted = [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const groups = new Map()
  for (const row of sorted) { const key = keyOf ? keyOf(row) : ''; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row) }
  const keys = [...groups.keys()].sort((a, b) => (groupBy === 'month' ? b.localeCompare(a) : a.localeCompare(b, 'el')))
  // The three commonest cause categories of the period.
  const causes = CAUSE_CATEGORIES.map(item => [item, rows.filter(row => (row.causeCategories || []).includes(item.value)).length])
    .filter(([, count]) => count).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([item, count]) => `${item.label[en ? 1 : 0]} ${count}`).join(', ')
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title: en ? 'Deviations' : 'Αποκλίσεις',
    filename: en ? 'deviations' : 'apokliseis',
    meta: [
      ...(period ? [[en ? 'Period' : 'Περίοδος', period]] : []),
      [en ? 'Deviations' : 'Αποκλίσεις', String(rows.length)],
      [en ? 'Open / in progress' : 'Ανοιχτές / σε εξέλιξη', `${rows.filter(row => row.status === 'open').length} / ${rows.filter(row => row.status === 'inProgress').length}`],
      [en ? 'Without action' : 'Χωρίς ενέργεια', String(rows.filter(row => row.status !== 'closed' && !row.hasCapa).length)],
      [en ? 'Recurring' : 'Επαναλαμβανόμενες', String(rows.filter(row => row.recurring).length)],
      ...(causes ? [[en ? 'Commonest causes' : 'Συχνότερες αιτίες', causes]] : []),
    ],
    sections: keys.map(key => ({ title: groupBy === 'none' ? '' : `${groupBy === 'month' ? monthName(key) : key} · ${groups.get(key).length}`, table: { columns, rows: groups.get(key).map(line) } })),
  }
}
