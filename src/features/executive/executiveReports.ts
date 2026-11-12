// The two documents of the hospital overview (owner, 7/11/2026), on the shared report layout:
// «Αναφορά Δ.Σ.» — what needs attention / improved, every measure this period / the comparison / change / target / status and the
// departments at a glance, in 1–2 pages; «Αναφορά τμήματος» — one department against the departments' average
// and against the comparison, one page to hand to the department.
import { measuresByArea } from './executiveModel'
import { assessmentOf, changeText, notStartedReason } from './executiveInsights'

const fmt = (value, unit, en) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)
const toneClass = { good: 'rd-good', warning: 'rd-warn', danger: 'rd-bad' }

// «Αναφορά Δ.Σ.» (owner, 8/11/2026): the same as the summary — what needs attention and what got better, the table of
// the measures, the comparison of the departments and, last, the measures whose calculation has not started yet.
export function boardReportDocument({ kpis, highlights = { attention: [], improved: [] }, compared = true, grid, hospital, periodLine, compareLabel, versus = String(compareLabel).toLowerCase(), currentLabel, language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  const withData = kpis.filter((item) => item.value != null)
  const empty = kpis.filter((item) => item.value == null)
  const span = compared ? 6 : 4
  const rows = measuresByArea(withData).flatMap((area) => [
    [{ html: `<strong>${tx(...area.label)}</strong>`, colSpan: span, className: 'rd-muted' }],
    ...area.rows.map((item) => {
      const change = changeText(item, en), assessment = assessmentOf(item, en)
      const changeCell = { text: change.text, className: `rd-num ${change.good == null ? '' : change.good ? 'rd-good' : 'rd-bad'}`.trim() }
      return [tx(...item.label), { text: fmt(item.value, item.unit, en), className: 'rd-num' }, ...(compared ? [{ text: fmt(item.delta?.previous, item.unit, en), className: 'rd-num' }, changeCell] : []), item.target || '—', { text: assessment.text, className: toneClass[assessment.tone] || '' }]
    }),
  ])
  const sections = []
  if (highlights.attention.length) sections.push({ title: tx('Χρειάζονται προσοχή', 'Need attention'), list: highlights.attention.map((item) => `${item.up == null ? '●' : item.up ? '▲' : '▼'} ${item.text}`) })
  if (highlights.improved.length) sections.push({ title: tx('Βελτιώθηκαν', 'Improved'), list: highlights.improved.map((item) => `${item.up ? '▲' : '▼'} ${item.text}`) })
  sections.push({ title: tx('Δείκτες', 'Measures'), table: { columns: [tx('Δείκτης', 'Measure'), currentLabel || tx('Περίοδος', 'Period'), ...(compared ? [compareLabel, tx('Μεταβολή', 'Change')] : []), tx('Στόχος', 'Target'), tx('Αξιολόγηση', 'Assessment')], rows, empty: tx('Ο υπολογισμός των δεικτών δεν έχει ξεκινήσει ακόμη.', 'The measures are not calculated yet.') } })
  if (grid.rows.length > 1) sections.push({ title: tx('Σύγκριση τμημάτων', 'Comparison of departments'), note: tx(`Χρώμα: σε σχέση με τον στόχο · ▲▼: σε σχέση με ${versus}.`, `Colour: against the target · ▲▼: against ${versus}.`), table: { columns: [tx('Τμήμα', 'Department'), ...grid.columns.map((column) => tx(...column.label))], rows: grid.rows.map((row) => [row.name, ...row.cells.map((cell) => ({ text: `${fmt(cell.value, cell.unit, en)}${cell.trend ? (cell.trend === 'up' ? ' ▲' : ' ▼') : ''}`, className: `rd-num ${toneClass[cell.tone] || ''}` }))]) } })
  if (empty.length) sections.push({ title: tx('Ο υπολογισμός δεν έχει ξεκινήσει ακόμη', 'Not calculated yet'), list: empty.map((item) => `${tx(...item.label)}: ${notStartedReason(item, en)}`) })
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
    sections: [{ title: tx('Δείκτες του τμήματος', 'The department\'s measures'), note: tx('Μέσος όρος: των τμημάτων του νοσοκομείου στην ίδια περίοδο.', 'Average: of the hospital\'s departments in the same period.'), table: { columns: [tx('Δείκτης', 'Measure'), department, tx('Μέσος όρος τμημάτων', 'Departments\' average'), compareLabel, tx('Σύγκριση', 'Comparison')], rows, empty: tx('Ο υπολογισμός για το τμήμα δεν έχει ξεκινήσει ακόμη.', 'Not calculated for the department yet.') } }],
    signatures: [tx('Υπεύθυνος/η Ποιότητας', 'Quality manager'), tx('Προϊστάμενος/η τμήματος', 'Head of department')],
    filename: en ? 'department-report' : 'anafora-tmimatos',
  }
}
