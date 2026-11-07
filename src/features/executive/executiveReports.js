// The two documents of the hospital overview (owner, 7/11/2026), on the shared report layout:
// «Αναφορά Δ.Σ.» — what changed, every measure this period / the comparison / change / target / status and the
// departments at a glance, in 1–2 pages; «Αναφορά τμήματος» — one department against the departments' average
// and against the comparison, one page to hand to the department.
import { measuresByArea } from './executiveModel'

const fmt = (value, unit, en) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)
const statusOf = (item, tx) => item.value == null ? tx('Χωρίς δεδομένα', 'No data') : item.status === 'noTarget' ? tx('Χωρίς στόχο', 'No target') : item.tone === 'danger' ? tx('Εκτός στόχου', 'Off target') : item.tone === 'warning' ? tx('Προσοχή', 'Attention') : item.tone === 'good' ? tx('Εντός στόχου', 'On target') : '—'
const changeOf = (item, en) => {
  const d = item.delta
  if (!d || d.good == null) return { text: d ? (en ? 'unchanged' : 'σταθερό') : '—', className: '' }
  return { text: `${d.diff > 0 ? '▲ +' : '▼ '}${fmt(d.diff, '', en)}${item.unit === '%' ? (en ? ' pts' : ' μον.') : ''}`, className: d.good ? 'rd-good' : 'rd-bad' }
}
const toneClass = { good: 'rd-good', warning: 'rd-warn', danger: 'rd-bad' }

export function boardReportDocument({ kpis, sentences, grid, hospital, periodLine, compareLabel, language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  const withData = kpis.filter((item) => item.value != null)
  const empty = kpis.filter((item) => item.value == null)
  const rows = measuresByArea(withData).flatMap((area) => [
    [{ html: `<strong>${tx(...area.label)}</strong>`, colSpan: 6, className: 'rd-muted' }],
    ...area.rows.map((item) => {
      const change = changeOf(item, en)
      return [tx(...item.label), { text: fmt(item.value, item.unit, en), className: 'rd-num' }, { text: fmt(item.delta?.previous, item.unit, en), className: 'rd-num' }, { text: change.text, className: change.className }, item.target || '—', { text: statusOf(item, tx), className: toneClass[item.tone] || '' }]
    }),
  ])
  const sections = []
  if (sentences.length) sections.push({ title: tx('Τι άλλαξε', 'What changed'), list: sentences.map((sentence) => `${sentence.good ? '▲' : '▼'} ${sentence.text}`) })
  sections.push({ title: tx('Δείκτες', 'Measures'), table: { columns: [tx('Δείκτης', 'Measure'), tx('Τιμή', 'Value'), compareLabel, tx('Μεταβολή', 'Change'), tx('Στόχος', 'Target'), tx('Κατάσταση', 'Status')], rows, empty: tx('Δεν υπάρχουν δεδομένα.', 'No data.') } })
  if (grid.rows.length > 1) sections.push({ title: tx('Τμήματα με μια ματιά', 'Departments at a glance'), note: tx(`Χρώμα: σε σχέση με τον στόχο · ▲▼: σε σχέση με ${compareLabel.toLowerCase()}.`, `Colour: against the target · ▲▼: against ${compareLabel.toLowerCase()}.`), table: { columns: [tx('Τμήμα', 'Department'), ...grid.columns.map((column) => tx(...column.label))], rows: grid.rows.map((row) => [row.name, ...row.cells.map((cell) => ({ text: `${fmt(cell.value, cell.unit, en)}${cell.trend ? (cell.trend === 'up' ? ' ▲' : ' ▼') : ''}`, className: `rd-num ${toneClass[cell.tone] || ''}` }))]) } })
  if (empty.length) sections.push({ title: tx('Χωρίς δεδομένα ακόμη', 'No data yet'), text: empty.map((item) => tx(...item.label)).join(' · ') })
  return {
    language,
    kind: tx('Εικόνα νοσοκομείου', 'Hospital overview'),
    title: tx('Αναφορά προς το Διοικητικό Συμβούλιο', 'Report to the Board'),
    meta: [[tx('Νοσοκομείο', 'Hospital'), hospital], [tx('Περίοδος', 'Period'), periodLine]],
    sections,
    signatures: [tx('Συντάχθηκε', 'Prepared by'), tx('Εγκρίθηκε', 'Approved by')],
    filename: en ? 'board-report' : 'anafora-ds',
  }
}

export function departmentReportDocument({ department, profile, hospital, periodLine, compareLabel, language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  const rows = profile.map((row) => [
    tx(...row.label),
    { text: fmt(row.value, row.unit, en), className: `rd-num ${toneClass[row.tone] || ''}` },
    { text: fmt(row.average, row.unit, en), className: 'rd-num' },
    { text: fmt(row.previous, row.unit, en), className: 'rd-num' },
    { text: row.versus == null ? '—' : row.versus ? tx('Καλύτερα από τον μέσο όρο', 'Better than average') : tx('Χειρότερα από τον μέσο όρο', 'Worse than average'), className: row.versus == null ? '' : row.versus ? 'rd-good' : 'rd-bad' },
  ])
  return {
    language,
    kind: tx('Εικόνα νοσοκομείου', 'Hospital overview'),
    title: `${tx('Αναφορά τμήματος', 'Department report')} · ${department}`,
    meta: [[tx('Νοσοκομείο', 'Hospital'), hospital], [tx('Τμήμα', 'Department'), department], [tx('Περίοδος', 'Period'), periodLine]],
    sections: [{ title: tx('Δείκτες του τμήματος', 'The department\'s measures'), note: tx('Μέσος όρος: των τμημάτων του νοσοκομείου στην ίδια περίοδο.', 'Average: of the hospital\'s departments in the same period.'), table: { columns: [tx('Δείκτης', 'Measure'), department, tx('Μέσος όρος τμημάτων', 'Departments\' average'), compareLabel, tx('Σύγκριση', 'Comparison')], rows, empty: tx('Δεν υπάρχουν δεδομένα για το τμήμα.', 'No data for the department.') } }],
    signatures: [tx('Υπεύθυνος/η Ποιότητας', 'Quality manager'), tx('Προϊστάμενος/η τμήματος', 'Head of department')],
    filename: en ? 'department-report' : 'anafora-tmimatos',
  }
}
