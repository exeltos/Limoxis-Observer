import { useEffect, useRef, useState } from 'react'
import '../analysis/AnalysisCharts.css'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import { shortMonth, type Bucket, type BucketPositives, type MonthlyHandHygiene } from './departmentHomeModel'

// The two charts of «Το τμήμα μου», drawn as the Analysis charts are (AnalysisCharts):
// recessive grid and axes, thin marks, the validated categorical order (blue first,
// orange second), a hover tooltip per mark. Each fills the height of its card. The comparison period is a grey
// dashed line, position by position (week n with week n, month n with month n).
const OTHER = SERIES_COLORS[0], MDR = SERIES_COLORS[1], LINE = SERIES_COLORS[0]
const fmt = (value: number, en: boolean) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
const dayMonth = (day: string) => { const [, m, d] = day.split('-').map(Number); return `${d}/${m}` }
const monthName = (month: string, en: boolean) => shortMonth(Number(month.slice(5, 7)), en ? 'en' : 'el')
const pathOf = (points: Array<[number, number]>) => points.map(([px, py], k) => `${k ? 'L' : 'M'}${px},${py}`).join(' ')

// The size the chart has on screen (its card decides it).
function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 560, height: 180 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width), height = Math.round(entry.contentRect.height)
      if (width > 0 && height > 0) setBox({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width: box.width, height: box.height }
}

// Every how many marks an axis label fits (about 40px each), so twelve months on a tablet do not overlap.
const labelEvery = (count: number, width: number) => Math.max(1, Math.ceil(count / Math.max(1, Math.floor(width / 40))))

// An axis maximum that divides into four whole steps.
const niceMax = (value: number) => Math.max(4, Math.ceil(value / 4) * 4)

// Positive samples per week (or month), MDR/XDR stacked on the others (2px surface gap between the two), and the
// comparison period's totals as a grey dashed line.
interface PositivesChartProps { rows: BucketPositives[], compareRows: BucketPositives[], bucket: Bucket, from: string, en: boolean, label: string, compareLabel: string }
export function PositivesChart({ rows, compareRows, bucket, from, en, label, compareLabel }: PositivesChartProps) {
  const { ref, width: w, height: h } = useBox()
  const [hover, setHover] = useState<number | null>(null)
  const total = rows.reduce((sum, row) => sum + row.mdr + row.other, 0)
  const slots = Math.max(1, rows.length, compareRows.length)
  const before = (i: number) => compareRows[i] ? compareRows[i].mdr + compareRows[i].other : null
  const pl = 28, pr = 8, pt = 8, pb = 22
  const max = niceMax(Math.max(0, ...rows.map(row => row.mdr + row.other), ...compareRows.map(row => row.mdr + row.other)))
  const step = (w - pl - pr) / slots
  const bar = Math.max(6, Math.min(40, step * 0.62))
  const y = (value: number) => pt + (1 - value / max) * (h - pt - pb)
  const ticks = [0, 1, 2, 3, 4].map(k => max * k / 4)
  // A week reads by its first day in the period, a month by its name.
  const name = (start: string, i: number) => bucket === 'month' ? monthName(start, en) : dayMonth(i === 0 && start < from ? from : start)
  const every = labelEvery(slots, w - pl - pr)
  const line = pathOf(compareRows.map((_, i) => [pl + (i + 0.5) * step, y(before(i) as number)]))
  const summary = `${label}: ${rows.map((row, i) => `${name(row.start, i)} ${row.mdr + row.other}`).join(', ')}. ${compareLabel}: ${compareRows.map((row, i) => `${bucket === 'month' ? monthName(row.start, en) : dayMonth(row.start)} ${before(i)}`).join(', ')}`
  return <div className="dephome-chart" ref={ref} onMouseLeave={() => setHover(null)}>
    {total === 0 && <p className="dephome-chart-empty"><span>{en ? 'No positive samples in the period.' : 'Κανένα θετικό δείγμα στην περίοδο.'}</span></p>}
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={summary}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} className="viz-grid"/><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{fmt(t, en)}</text></g>)}
      {rows.map((row, i) => {
        const x = pl + i * step + (step - bar) / 2
        const otherTop = y(row.other), mdrTop = y(row.other + row.mdr)
        const gap = row.other && row.mdr ? 2 : 0
        return <g key={row.start} opacity={hover == null || hover === i ? 1 : 0.55}>
          {row.other > 0 && <path d={roundedTop(x, otherTop, bar, y(0) - otherTop, row.mdr ? 0 : 4)} fill={OTHER}/>}
          {row.mdr > 0 && <path d={roundedTop(x, mdrTop, bar, Math.max(1, otherTop - mdrTop - gap), 4)} fill={MDR}/>}
          {i % every === 0 ? <text x={x + bar / 2} y={h - 6} textAnchor="middle" className="viz-axis">{name(row.start, i)}</text> : null}
        </g>
      })}
      {compareRows.length > 1 && <path d={line} fill="none" className="dephome-compare-line"/>}
      {compareRows.length === 1 && <circle cx={pl + 0.5 * step} cy={y(before(0) as number)} r={3} className="dephome-compare-point"/>}
      {Array.from({ length: slots }, (_, i) => <rect key={`hit-${i}`} x={pl + i * step} y={pt} width={step} height={h - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)}/>)}
    </svg>
    {hover != null && <div className="viz-tooltip" style={{ left: `${(pl + (hover + 0.5) * step) / w * 100}%` }}>
      <span>{rows[hover] ? (bucket === 'month' ? monthName(rows[hover].start, en) : `${en ? 'Week of' : 'Εβδομάδα'} ${name(rows[hover].start, hover)}`) : '—'}</span>
      <strong>{rows[hover] ? fmt(rows[hover].mdr + rows[hover].other, en) : '—'}</strong>
      {rows[hover] && <small>MDR/XDR {fmt(rows[hover].mdr, en)} · {en ? 'Other' : 'Λοιπά'} {fmt(rows[hover].other, en)}</small>}
      {before(hover) != null && <small>{compareLabel}: {fmt(before(hover) as number, en)}</small>}
    </div>}
  </div>
}

// A bar with its top corners rounded (4px data end), anchored to the baseline.
function roundedTop(x: number, top: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, Math.max(0, height))
  const bottom = top + Math.max(0, height)
  return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${bottom} Z`
}

// Hand hygiene compliance per month (a line through the months with observations), the target dashed and the
// comparison period's months as a grey dashed line, month n with month n.
interface HandHygieneChartProps { rows: MonthlyHandHygiene[], compareRows: MonthlyHandHygiene[], target: number, en: boolean, label: string, compareLabel: string }
export function HandHygieneChart({ rows, compareRows, target, en, label, compareLabel }: HandHygieneChartProps) {
  const { ref, width: w, height: h } = useBox()
  const [hover, setHover] = useState<number | null>(null)
  const known = rows.map((row, index) => ({ ...row, index })).filter(row => row.pct != null)
  const pl = 34, pr = 14, pt = 10, pb = 22
  const before = compareRows.map((row, index) => ({ ...row, index })).filter(row => row.pct != null && row.index < rows.length)
  const low = Math.max(0, Math.floor((Math.min(target, ...known.map(row => row.pct as number), ...before.map(row => row.pct as number)) - 10) / 10) * 10)
  const step = (w - pl - pr) / Math.max(1, rows.length)
  const x = (i: number) => pl + (i + 0.5) * step
  const y = (value: number) => pt + (1 - (value - low) / (100 - low)) * (h - pt - pb)
  const ticks = [low, low + (100 - low) / 2, 100]
  const line = pathOf(known.map(row => [x(row.index), y(row.pct as number)]))
  const compareLine = pathOf(before.map(row => [x(row.index), y(row.pct as number)]))
  const summary = `${label}: ${rows.map(row => `${monthName(row.month, en)} ${row.pct == null ? '—' : `${fmt(row.pct, en)}%`}`).join(', ')}. ${compareLabel}: ${compareRows.map(row => `${monthName(row.month, en)} ${row.pct == null ? '—' : `${fmt(row.pct, en)}%`}`).join(', ')}`
  return <div className="dephome-chart" ref={ref} onMouseLeave={() => setHover(null)}>
    {!known.length && <p className="dephome-chart-empty"><span>{en ? 'No observations in these months.' : 'Καμία παρατήρηση αυτούς τους μήνες.'}</span></p>}
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={summary}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} className="viz-grid"/><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{fmt(Math.round(t), en)}%</text></g>)}
      <line x1={pl} x2={w - pr} y1={y(target)} y2={y(target)} className="dephome-target"/>
      <text x={w - pr} y={y(target) + 14} textAnchor="end" className="dephome-target-label">{en ? 'target' : 'στόχος'} {fmt(target, en)}%</text>
      {rows.map((row, i) => i % labelEvery(rows.length, w - pl - pr) === 0 ? <text key={row.month} x={x(i)} y={h - 6} textAnchor="middle" className="viz-axis">{monthName(row.month, en)}</text> : null)}
      {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={h - pb} className="viz-crosshair"/>}
      {before.length > 1 && <path d={compareLine} fill="none" className="dephome-compare-line"/>}
      {before.length === 1 && <circle cx={x(before[0].index)} cy={y(before[0].pct as number)} r={3} className="dephome-compare-point"/>}
      {known.length > 1 && <path d={line} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
      {known.map(row => <circle key={row.month} cx={x(row.index)} cy={y(row.pct as number)} r={hover === row.index ? 6 : 4} className="dephome-point" stroke={LINE} strokeWidth="2"/>)}
      {rows.map((row, i) => <rect key={`hit-${row.month}`} x={pl + i * step} y={pt} width={step} height={h - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)}/>)}
    </svg>
    {hover != null && rows[hover] && <div className="viz-tooltip" style={{ left: `${x(hover) / w * 100}%` }}>
      <span>{monthName(rows[hover].month, en)}</span>
      <strong>{rows[hover].pct == null ? '—' : `${fmt(rows[hover].pct as number, en)}%`}</strong>
      <small>{rows[hover].observations ? `${fmt(rows[hover].compliant, en)}/${fmt(rows[hover].observations, en)} ${en ? 'opportunities' : 'ευκαιρίες'}` : (en ? 'no observations' : 'χωρίς παρατηρήσεις')}</small>
      {compareRows[hover] && <small>{monthName(compareRows[hover].month, en)} {compareRows[hover].month.slice(0, 4)}: {compareRows[hover].pct == null ? '—' : `${fmt(compareRows[hover].pct as number, en)}%`}</small>}
    </div>}
  </div>
}
