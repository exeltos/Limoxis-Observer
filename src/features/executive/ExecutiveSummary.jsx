import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { measuresByArea } from './executiveModel'
import { changeSentences, departmentGrid, sparkPoints } from './executiveInsights'
const fmt = (value, unit, en) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

// This year (solid) and the comparison (dashed) by month, on one scale.
function Sparkline({ points, label }) {
  const values = points.flatMap((point) => [point.now, point.before]).filter((value) => value != null)
  if (values.length < 2) return null
  const w = 132, h = 34, low = Math.min(...values), high = Math.max(...values), span = high - low || 1
  const x = (i) => (i * w) / (points.length - 1)
  const y = (value) => h - 3 - ((value - low) / span) * (h - 6)
  const path = (key) => points.map((point, i) => (point[key] == null ? null : `${x(i).toFixed(1)},${y(point[key]).toFixed(1)}`)).filter(Boolean).join(' ')
  return <svg className="exec-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
    <polyline className="exec-spark-before" points={path('before')} />
    <polyline className="exec-spark-now" points={path('now')} />
  </svg>
}

// One measure: value, target, the comparison and its change, the status and the line of the months.
function MeasureCard({ item, en, tx, busy, failed, onOpen, points, against }) {
  const tone = item.value == null ? 'neutral' : item.tone || 'neutral'
  const d = item.delta
  const status = busy || failed ? '—' : item.status === 'noTarget' ? tx('Χωρίς στόχο', 'No target') : tone === 'danger' ? tx('Εκτός στόχου', 'Off target') : tone === 'warning' ? tx('Προσοχή', 'Attention') : tone === 'good' ? tx('Εντός στόχου', 'On target') : '—'
  const change = d && d.good != null ? `${d.diff > 0 ? '+' : ''}${fmt(d.diff, item.unit === '%' ? '' : '', en)}${item.unit === '%' ? tx(' μον.', ' pts') : ''}` : null
  const Tag = onOpen ? 'button' : 'div'
  return <Tag type={onOpen ? 'button' : undefined} className={`exec-measure-card exec-tone-${tone}`} onClick={onOpen}>
    <span className="exec-measure-main">
      <span className="exec-measure-label">{tx(...item.label)}</span>
      <b className="exec-measure-value">{busy ? '…' : failed ? '—' : fmt(item.value, item.unit, en)}</b>
      <small>{[item.target ? `${tx('Στόχος', 'Target')} ${item.target}` : null, d?.previous != null ? `${against} ${fmt(d.previous, item.unit, en)}` : null].filter(Boolean).join(' · ') || tx(...item.hint)}</small>
    </span>
    <span className="exec-measure-side">
      {points && <Sparkline points={points} label={tx('Ανά μήνα: φέτος και σύγκριση', 'By month: now and the comparison')} />}
      {change && <span className={`exec-measure-change ${d.good ? 'is-better' : 'is-worse'}`}>{d.diff > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}{change}</span>}
      <span className="exec-measure-status"><i className={`exec-dot exec-dot-${tone}`} aria-hidden="true" />{status}</span>
    </span>
  </Tag>
}

// «Σύνοψη» of the hospital overview: «Τι άλλαξε», the measures by area as cards, the departments at a glance and,
// at the end, the measures with no data yet (owner, 7/11/2026: nothing empty in between).
export function ExecutiveSummary({ kpis, snapshot, previousSnapshot, range, targets, compareLabel, partsOf, onOpen, language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  const state = (item) => { const parts = partsOf(item); return { busy: parts.some((part) => !part || part.status === 'loading'), failed: parts.some((part) => part?.status === 'error') } }
  const hasData = (item) => item.value != null || state(item).busy
  const areas = measuresByArea(kpis.filter(hasData))
  const empty = kpis.filter((item) => !hasData(item))
  const sentences = previousSnapshot ? changeSentences(kpis, snapshot, { en }) : []
  const grid = departmentGrid(snapshot, previousSnapshot, targets)
  const against = compareLabel || tx('Πέρσι', 'Last year')
  return <div className="exec-summary">
    {sentences.length > 0 && <section className="exec-changes">
      <h3>{tx('Τι άλλαξε', 'What changed')} <small>{tx(`σε σχέση με ${against.toLowerCase()}`, `against ${against.toLowerCase()}`)}</small></h3>
      <ul>{sentences.map((sentence) => <li key={sentence.id} className={sentence.good ? 'is-better' : 'is-worse'}>{sentence.up ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownRight size={15} aria-hidden="true" />}<span>{sentence.text}</span></li>)}</ul>
    </section>}
    {areas.map((area) => <section key={area.id} className="exec-area-block">
      <h4>{tx(...area.label)}</h4>
      <div className="exec-measure-grid">{area.rows.map((item) => { const s = state(item); return <MeasureCard key={item.id} item={item} en={en} tx={tx} busy={s.busy} failed={s.failed} onOpen={onOpen(item)} against={against} points={sparkPoints(item.id, snapshot, previousSnapshot, range)} /> })}</div>
    </section>)}
    {grid.rows.length > 1 && <section className="exec-dept-grid">
      <h3>{tx('Τμήματα με μια ματιά', 'Departments at a glance')} <small>{tx('χρώμα: σε σχέση με τον στόχο · βέλος: σε σχέση με', 'colour: against the target · arrow: against')} {against.toLowerCase()}</small></h3>
      <div className="exec-dept-scroll"><table>
        <thead><tr><th>{tx('Τμήμα', 'Department')}</th>{grid.columns.map((column) => <th key={column.key}>{tx(...column.label)}</th>)}</tr></thead>
        <tbody>{grid.rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th>{row.cells.map((cell) => <td key={cell.key} className={`exec-cell-${cell.tone}`} title={cell.previous != null ? `${against}: ${fmt(cell.previous, cell.unit, en)}` : undefined}>{fmt(cell.value, cell.unit, en)}{cell.trend && <span className={cell.good ? 'is-better' : 'is-worse'}>{cell.trend === 'up' ? ' ▲' : ' ▼'}</span>}</td>)}</tr>)}</tbody>
      </table></div>
    </section>}
    {empty.length > 0 && <section className="exec-empty-measures">
      <h4>{tx('Χωρίς δεδομένα ακόμη', 'No data yet')}</h4>
      <p>{empty.map((item) => tx(...item.label)).join(' · ')}</p>
    </section>}
  </div>
}

