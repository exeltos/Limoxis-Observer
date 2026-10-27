import { ExportMenu } from '../../design-system/ExportMenu'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { printReport } from '../../core/export/reportDocument'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { frequencyLabel } from './controlScheduling'

const WEEKDAYS = { el: ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const plusDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// One missed execution as people read it: «Τρι 21/10/2026» and its times,
// or the week of a weekly control.
export function missedText(miss, language = 'el') {
  const en = language === 'en'
  if (miss.week) return { when: en ? `Week ${dmy(miss.day)} – ${dmy(plusDays(miss.day, 6))}` : `Εβδομάδα ${dmy(miss.day)} – ${dmy(plusDays(miss.day, 6))}`, times: en ? 'not done' : 'δεν έγινε' }
  const weekday = WEEKDAYS[en ? 'en' : 'el'][new Date(`${miss.day}T12:00:00Z`).getUTCDay()]
  return { when: `${weekday} ${dmy(miss.day)}`, times: miss.times?.length ? miss.times.join(', ') : en ? `${miss.missing} of the day's entries` : `${miss.missing} ${miss.missing === 1 ? 'καταγραφή' : 'καταγραφές'} της ημέρας` }
}

// The missed executions of one or more lines (control × department) of the
// adherence report, with their dates and times; printable.
export function ControlMissedDialog({ lines = [], title, language, onClose }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const shown = lines.filter((line) => line.missed > 0)
  const name = (item) => (en ? item.titleEn || item.title : item.title)
  const total = shown.reduce((sum, line) => sum + line.missed, 0)
  const head = (line) => `${name(line.item)} · ${line.department}`
  function print() {
    const ok = printReport({
      language, kind: en ? 'Controls' : 'Έλεγχοι',
      title: `${en ? 'Missed controls' : 'Χαμένοι έλεγχοι'} · ${title}`,
      meta: [[en ? 'Missed' : 'Χάθηκαν', String(total)]],
      sections: shown.map((line) => ({ title: `${head(line)} (${line.missed})`, table: { columns: [en ? 'Date' : 'Ημερομηνία', en ? 'Missed times' : 'Ώρες που χάθηκαν'], rows: (line.missedDays || []).map((miss) => { const text = missedText(miss, language); return [text.when, text.times] }), empty: en ? 'No dates for this frequency.' : 'Χωρίς ημερομηνίες για αυτή τη συχνότητα.' } })),
      signatures: [en ? 'Head of department' : 'Προϊστάμενος/η τμήματος', en ? 'Infection control' : 'Υπεύθυνος/η λοιμώξεων'],
      filename: en ? 'missed-controls' : 'xamenoi-elegxoi',
    })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }
  return <ObserverDialog width="wide" className="control-missed-dialog" eyebrow={en ? 'Missed controls' : 'Χαμένοι έλεγχοι'} title={title} subtitle={en ? `${total} missed` : `${total} ${total === 1 ? 'χαμένος' : 'χαμένοι'}`} onClose={onClose} footer={<>
    <ExportMenu disabled={!shown.length} items={[{ id: 'missed', kind: 'print', label: en ? 'Missed controls' : 'Χαμένοι έλεγχοι', onClick: print }]} />
    <Button onClick={onClose}>{en ? 'Close' : 'Κλείσιμο'}</Button>
  </>}>
    {shown.map((line) => <section key={`${line.item.id}|${line.department}`} className="control-missed-section">
      <header><strong>{head(line)}</strong><small>{frequencyLabel(line.frequency || line.item.frequency, language)} · {en ? `${line.missed} missed` : `χάθηκαν ${line.missed}`}</small></header>
      {(line.missedDays || []).length
        ? <ul>{line.missedDays.slice().reverse().map((miss) => { const text = missedText(miss, language); return <li key={miss.day}><span>{text.when}</span><strong>{text.times}</strong></li> })}</ul>
        : <p>{en ? 'The dates are named for daily and weekly controls.' : 'Οι ημερομηνίες φαίνονται για τους ημερήσιους και εβδομαδιαίους ελέγχους.'}</p>}
    </section>)}
  </ObserverDialog>
}
