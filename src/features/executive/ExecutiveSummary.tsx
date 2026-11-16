import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { measuresByArea, type ExecKpi, type ExecSnapshot } from './executiveModel'
import { assessmentOf, changeText, notStartedReason, summaryHighlights, type Highlight } from './executiveInsights'
const fmt = (value: number | null | undefined, unit: string | null | undefined, en: boolean) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

function Highlights({ title, items, tone }: { title: string, items: Highlight[], tone: string }) {
  return <section className={`exec-highlights exec-highlights-${tone}`}>
    <h3>{title} <small>{items.length}</small></h3>
    <ul>{items.map((item) => <li key={item.id} className={item.level === 'warning' ? 'is-warning' : undefined}>{item.up == null ? <i className={`exec-dot exec-dot-${tone === 'better' ? 'good' : 'danger'}`} aria-hidden="true" /> : item.up ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownRight size={15} aria-hidden="true" />}<span>{item.text}</span></li>)}</ul>
  </section>
}

// «Σύνοψη» of the hospital overview (owner, 16/11/2026): what needs attention; then «Κατάσταση σήμερα», what is pending now
// whenever it began, as cards with no comparison; then «Απόδοση περιόδου», only the measures that compare with the earlier
// period, each with its value, the comparison, the change and the target; at the end the measures not calculated yet.
interface ExecutiveSummaryProps { kpis: ExecKpi[], snapshot: ExecSnapshot | null, previousSnapshot: ExecSnapshot | null | undefined, compareLabel: string, against: string, currentLabel: string, onOpen: (item: ExecKpi) => (() => void) | null | undefined, language: string }
export function ExecutiveSummary({ kpis, snapshot, previousSnapshot, compareLabel, against, currentLabel, onOpen, language }: ExecutiveSummaryProps) {
  const en = language === 'en'
  const tx = (el: string, english: string) => (en ? english : el)
  const shown = kpis.filter((item) => item.value != null)
  const today = shown.filter((item) => item.pointInTime)
  const areas = measuresByArea(shown.filter((item) => !item.pointInTime))
  const empty = kpis.filter((item) => item.value == null)
  const { attention, improved } = summaryHighlights(kpis, snapshot, { en, against })
  const compared = Boolean(previousSnapshot)
  const name = (item: ExecKpi) => <>{tx(...item.label)}{item.note && <small className="exec-measure-note">{tx(...item.note)}</small>}</>
  return <div className="exec-summary">
    {(attention.length > 0 || improved.length > 0) && <div className="exec-highlights-row">
      <Highlights title={tx('Χρειάζονται προσοχή', 'Need attention')} items={attention} tone="worse" />
      {improved.length > 0 && <Highlights title={tx('Βελτιώθηκαν', 'Improved')} items={improved} tone="better" />}
    </div>}
    {today.length > 0 && <section className="exec-today-panel" aria-labelledby="exec-today-title">
      <h3 id="exec-today-title">{tx('Κατάσταση σήμερα', 'Status today')}</h3>
      <p>{tx('Ό,τι εκκρεμεί αυτή τη στιγμή, όποτε κι αν ξεκίνησε. Δεν συγκρίνεται με προηγούμενη περίοδο.', 'What is pending right now, whenever it began. Not compared with an earlier period.')}</p>
      <div className="exec-today-cards">{today.map((item) => {
        const open = onOpen(item), sub = [item.hint ? tx(...item.hint) : '', item.target ? tx(`στόχος ${item.target}`, `target ${item.target}`) : ''].filter(Boolean).join(' · ')
        const body = <><strong>{fmt(item.value, item.unit, en)}</strong><span>{tx(...item.label)}</span>{sub && <small>{sub}</small>}</>
        return open ? <button key={item.id} type="button" className={`exec-today-card is-${item.tone}`} onClick={open}>{body}</button> : <div key={item.id} className={`exec-today-card is-${item.tone}`}>{body}</div>
      })}</div>
    </section>}
    {areas.length > 0 && <section className="exec-scorecard" aria-labelledby="exec-period-title">
      <h3 id="exec-period-title" className="exec-scorecard-title">{compared ? tx(`Απόδοση περιόδου — ${currentLabel} έναντι ${against}`, `Period performance — ${currentLabel} against ${against}`) : tx('Απόδοση περιόδου', 'Period performance')}</h3>
      <table>
        <thead><tr>
          <th scope="col">{tx('Δείκτης', 'Measure')}</th>
          <th scope="col">{currentLabel}</th>
          {compared && <th scope="col">{compareLabel}</th>}
          {compared && <th scope="col">{tx('Μεταβολή', 'Change')}</th>}
          <th scope="col">{tx('Στόχος', 'Target')}</th>
          <th scope="col" className="exec-col-status">{tx('Αξιολόγηση', 'Assessment')}</th>
        </tr></thead>
        {areas.map((area) => <tbody key={area.id}>
          <tr className="exec-area-row"><th scope="rowgroup" colSpan={compared ? 6 : 4}>{tx(...area.label)}</th></tr>
          {area.rows.map((item) => {
            const open = onOpen(item), change = changeText(item, en), assessment = assessmentOf(item, en)
            return <tr key={item.id}>
              <th scope="row">{open ? <button type="button" className="exec-measure-link" onClick={open} title={tx(...(item.hint as [string, string]))}>{name(item)}</button> : <span title={tx(...(item.hint as [string, string]))}>{name(item)}</span>}</th>
              <td className="exec-num exec-value">{fmt(item.value, item.unit, en)}</td>
              {compared && <td className="exec-num">{fmt(item.delta?.previous, item.unit, en)}</td>}
              {compared && <td className={`exec-num${change.good == null ? '' : change.good ? ' is-better' : ' is-worse'}`}>{change.text}</td>}
              <td className="exec-num">{item.target || ''}</td>
              <td className="exec-col-status"><i className={`exec-dot exec-dot-${assessment.tone}`} aria-hidden="true" />{assessment.text}</td>
            </tr>
          })}
        </tbody>)}
      </table>
    </section>}
    {empty.length > 0 && <section className="exec-empty-measures">
      <h4>{tx('Ο υπολογισμός δεν έχει ξεκινήσει ακόμη', 'Not calculated yet')}</h4>
      <p>{empty.map((item) => `${tx(...item.label)} (${notStartedReason(item, en)})`).join(' · ')}</p>
    </section>}
  </div>
}
