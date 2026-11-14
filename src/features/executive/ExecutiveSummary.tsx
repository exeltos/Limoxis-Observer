import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { measuresByArea, type DayRange, type ExecKpi, type ExecSnapshot } from './executiveModel'
import { assessmentOf, changeText, notStartedReason, sparkPoints, summaryHighlights, type Highlight } from './executiveInsights'
const fmt = (value: number | null | undefined, unit: string | null | undefined, en: boolean) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

// This year (solid) and the comparison (dashed) by month, on one scale.
type SparkPoint = { month: number, now: number | null, before: number | null }
function Sparkline({ points, label }: { points: SparkPoint[], label: string }) {
  const values = points.flatMap((point) => [point.now, point.before]).filter((value): value is number => value != null)
  if (values.length < 2) return null
  const w = 100, h = 22, low = Math.min(...values), high = Math.max(...values), span = high - low || 1
  const x = (i: number) => (i * w) / (points.length - 1)
  const y = (value: number) => h - 3 - ((value - low) / span) * (h - 6)
  const path = (key: 'now' | 'before') => points.map((point, i) => (point[key] == null ? null : `${x(i).toFixed(1)},${y(point[key] as number).toFixed(1)}`)).filter(Boolean).join(' ')
  return <svg className="exec-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
    <polyline className="exec-spark-before" points={path('before')} />
    <polyline className="exec-spark-now" points={path('now')} />
  </svg>
}

function Highlights({ title, items, tone }: { title: string, items: Highlight[], tone: string }) {
  return <section className={`exec-highlights exec-highlights-${tone}`}>
    <h3>{title} <small>{items.length}</small></h3>
    <ul>{items.map((item) => <li key={item.id}>{item.up == null ? <i className={`exec-dot exec-dot-${tone === 'better' ? 'good' : 'danger'}`} aria-hidden="true" /> : item.up ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownRight size={15} aria-hidden="true" />}<span>{item.text}</span></li>)}</ul>
  </section>
}

// «Σύνοψη» of the hospital overview (owner, 8/11/2026): what needs attention and what got better, then one table of every
// measure by area (this period, the comparison, the change, the target, the months and the assessment) and, at the end,
// the measures whose calculation has not started yet. The departments are compared in the «Τμήματα» tab.
interface ExecutiveSummaryProps { kpis: ExecKpi[], snapshot: ExecSnapshot | null, previousSnapshot: ExecSnapshot | null | undefined, range: DayRange | null, compareLabel: string, against: string, currentLabel: string, onOpen: (item: ExecKpi) => (() => void) | null | undefined, language: string }
export function ExecutiveSummary({ kpis, snapshot, previousSnapshot, range, compareLabel, against, currentLabel, onOpen, language }: ExecutiveSummaryProps) {
  const en = language === 'en'
  const tx = (el: string, english: string) => (en ? english : el)
  const areas = measuresByArea(kpis.filter((item) => item.value != null))
  const empty = kpis.filter((item) => item.value == null)
  const { attention, improved } = summaryHighlights(kpis, snapshot, { en, against })
  const compared = Boolean(previousSnapshot)
  return <div className="exec-summary">
    {(attention.length > 0 || improved.length > 0) && <div className="exec-highlights-row">
      <Highlights title={tx('Χρειάζονται προσοχή', 'Need attention')} items={attention} tone="worse" />
      {improved.length > 0 && <Highlights title={tx('Βελτιώθηκαν', 'Improved')} items={improved} tone="better" />}
    </div>}
    {areas.length > 0 && <section className="exec-scorecard">
      <table>
        <thead><tr>
          <th scope="col">{tx('Δείκτης', 'Measure')}</th>
          <th scope="col">{currentLabel}</th>
          {compared && <th scope="col">{compareLabel}</th>}
          {compared && <th scope="col">{tx('Μεταβολή', 'Change')}</th>}
          <th scope="col">{tx('Στόχος', 'Target')}</th>
          <th scope="col" className="exec-col-spark">{tx('Ανά μήνα', 'By month')}</th>
          <th scope="col" className="exec-col-status">{tx('Αξιολόγηση', 'Assessment')}</th>
        </tr></thead>
        {areas.map((area) => <tbody key={area.id}>
          <tr className="exec-area-row"><th scope="rowgroup" colSpan={compared ? 7 : 5}>{tx(...area.label)}</th></tr>
          {area.rows.map((item) => {
            const open = onOpen(item), change = changeText(item, en), assessment = assessmentOf(item, en)
            const points = sparkPoints(item.id, snapshot, previousSnapshot, range)
            return <tr key={item.id}>
              <th scope="row">{open ? <button type="button" className="exec-measure-link" onClick={open} title={tx(...(item.hint as [string, string]))}>{tx(...item.label)}</button> : <span title={tx(...(item.hint as [string, string]))}>{tx(...item.label)}</span>}</th>
              <td className="exec-num exec-value">{fmt(item.value, item.unit, en)}</td>
              {compared && <td className="exec-num">{fmt(item.delta?.previous, item.unit, en)}</td>}
              {compared && <td className={`exec-num${change.good == null ? '' : change.good ? ' is-better' : ' is-worse'}`}>{change.text}</td>}
              <td className="exec-num">{item.target || '—'}</td>
              <td className="exec-col-spark">{points && <Sparkline points={points} label={tx('Ανά μήνα: η περίοδος και η σύγκριση', 'By month: the period and the comparison')} />}</td>
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
