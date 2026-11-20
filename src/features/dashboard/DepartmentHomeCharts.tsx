import { useEffect, useRef, useState } from 'react'
import '../analysis/AnalysisCharts.css'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import type { MonthlyHandHygiene, WeeklyPositives } from './departmentHomeModel'

// The two charts of «Το τμήμα μου», drawn as the Analysis charts are (AnalysisCharts):
// recessive grid and axes, thin marks, the validated categorical order (blue first,
// orange second), a hover tooltip per mark. Each fills the height of its card.
const OTHER = SERIES_COLORS[0], MDR = SERIES_COLORS[1], LINE = SERIES_COLORS[0]
const MONTHS: Record<string, string[]> = { el: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
const fmt = (value: number, en: boolean) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
const dayMonth = (day: string) => { const [, m, d] = day.split('-').map(Number); return `${d}/${m}` }
const monthName = (month: string, en: boolean) => MONTHS[en ? 'en' : 'el'][Number(month.slice(5, 7)) - 1] || month

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

// An axis maximum that divides into four whole steps.
const niceMax = (value: number) => Math.max(4, Math.ceil(value / 4) * 4)

// Positive samples per week, MDR/XDR stacked on the others (2px surface gap between the two).
export function WeeklyPositivesChart({ rows, en, label }: { rows: WeeklyPositives[], en: boolean, label: string }) {
  const { ref, width: w, height: h } = useBox()
  const [hover, setHover] = useState<number | null>(null)
  const total = rows.reduce((sum, row) => sum + row.mdr + row.other, 0)
  const pl = 28, pr = 8, pt = 8, pb = 22
  const max = niceMax(Math.max(0, ...rows.map(row => row.mdr + row.other)))
  const step = (w - pl - pr) / Math.max(1, rows.length)
  const bar = Math.max(6, Math.min(40, step * 0.62))
  const y = (value: number) => pt + (1 - value / max) * (h - pt - pb)
  const ticks = [0, 1, 2, 3, 4].map(k => max * k / 4)
  const summary = `${label}: ${rows.map(row => `${dayMonth(row.week)} ${row.mdr + row.other}`).join(', ')}`
  return <div className="dephome-chart" ref={ref} onMouseLeave={() => setHover(null)}>
    {total === 0 && <p className="dephome-chart-empty"><span>{en ? 'No positive samples in the last 12 weeks.' : 'Κανένα θετικό δείγμα τις τελευταίες 12 εβδομάδες.'}</span></p>}
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={summary}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} className="viz-grid"/><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{fmt(t, en)}</text></g>)}
      {rows.map((row, i) => {
        const x = pl + i * step + (step - bar) / 2
        const otherTop = y(row.other), mdrTop = y(row.other + row.mdr)
        const gap = row.other && row.mdr ? 2 : 0
        return <g key={row.week} opacity={hover == null || hover === i ? 1 : 0.55}>
          {row.other > 0 && <path d={roundedTop(x, otherTop, bar, y(0) - otherTop, row.mdr ? 0 : 4)} fill={OTHER}/>}
          {row.mdr > 0 && <path d={roundedTop(x, mdrTop, bar, Math.max(1, otherTop - mdrTop - gap), 4)} fill={MDR}/>}
          {i % 4 === 0 || i === rows.length - 1 ? <text x={x + bar / 2} y={h - 6} textAnchor="middle" className="viz-axis">{dayMonth(row.week)}</text> : null}
          <rect x={pl + i * step} y={pt} width={step} height={h - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)}/>
        </g>
      })}
    </svg>
    {hover != null && rows[hover] && <div className="viz-tooltip" style={{ left: `${(pl + (hover + 0.5) * step) / w * 100}%` }}>
      <span>{en ? 'Week of' : 'Εβδομάδα'} {dayMonth(rows[hover].week)}</span>
      <strong>{fmt(rows[hover].mdr + rows[hover].other, en)}</strong>
      <small>MDR/XDR {fmt(rows[hover].mdr, en)} · {en ? 'Other' : 'Λοιπά'} {fmt(rows[hover].other, en)}</small>
    </div>}
  </div>
}

// A bar with its top corners rounded (4px data end), anchored to the baseline.
function roundedTop(x: number, top: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, Math.max(0, height))
  const bottom = top + Math.max(0, height)
  return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${bottom} Z`
}

// Hand hygiene compliance per month (a line through the months with observations) and the target dashed.
export function HandHygieneChart({ rows, target, en, label }: { rows: MonthlyHandHygiene[], target: number, en: boolean, label: string }) {
  const { ref, width: w, height: h } = useBox()
  const [hover, setHover] = useState<number | null>(null)
  const known = rows.map((row, index) => ({ ...row, index })).filter(row => row.pct != null)
  const pl = 34, pr = 14, pt = 10, pb = 22
  const low = Math.max(0, Math.floor((Math.min(target, ...known.map(row => row.pct as number)) - 10) / 10) * 10)
  const step = (w - pl - pr) / Math.max(1, rows.length)
  const x = (i: number) => pl + (i + 0.5) * step
  const y = (value: number) => pt + (1 - (value - low) / (100 - low)) * (h - pt - pb)
  const ticks = [low, low + (100 - low) / 2, 100]
  const line = known.map((row, k) => `${k ? 'L' : 'M'}${x(row.index)},${y(row.pct as number)}`).join(' ')
  const summary = `${label}: ${rows.map(row => `${monthName(row.month, en)} ${row.pct == null ? '—' : `${fmt(row.pct, en)}%`}`).join(', ')}`
  return <div className="dephome-chart" ref={ref} onMouseLeave={() => setHover(null)}>
    {!known.length && <p className="dephome-chart-empty"><span>{en ? 'No observations in the last 6 months.' : 'Καμία παρατήρηση τους τελευταίους 6 μήνες.'}</span></p>}
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={summary}>
      {ticks.map(t => <g key={t}><line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} className="viz-grid"/><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{fmt(Math.round(t), en)}%</text></g>)}
      <line x1={pl} x2={w - pr} y1={y(target)} y2={y(target)} className="dephome-target"/>
      <text x={w - pr} y={y(target) + 14} textAnchor="end" className="dephome-target-label">{en ? 'target' : 'στόχος'} {fmt(target, en)}%</text>
      {rows.map((row, i) => <text key={row.month} x={x(i)} y={h - 6} textAnchor="middle" className="viz-axis">{monthName(row.month, en)}</text>)}
      {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={h - pb} className="viz-crosshair"/>}
      {known.length > 1 && <path d={line} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
      {known.map(row => <circle key={row.month} cx={x(row.index)} cy={y(row.pct as number)} r={hover === row.index ? 6 : 4} className="dephome-point" stroke={LINE} strokeWidth="2"/>)}
      {rows.map((row, i) => <rect key={`hit-${row.month}`} x={pl + i * step} y={pt} width={step} height={h - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)}/>)}
    </svg>
    {hover != null && rows[hover] && <div className="viz-tooltip" style={{ left: `${x(hover) / w * 100}%` }}>
      <span>{monthName(rows[hover].month, en)}</span>
      <strong>{rows[hover].pct == null ? '—' : `${fmt(rows[hover].pct as number, en)}%`}</strong>
      <small>{rows[hover].observations ? `${fmt(rows[hover].compliant, en)}/${fmt(rows[hover].observations, en)} ${en ? 'opportunities' : 'ευκαιρίες'}` : (en ? 'no observations' : 'χωρίς παρατηρήσεις')}</small>
    </div>}
  </div>
}
