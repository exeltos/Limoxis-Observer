import type { ReactNode } from 'react'
import { Card, CardHeader } from '../../design-system/Card'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import type { DepartmentHomeOverview } from './departmentHomeModel'

// «Μικρόβια του τμήματος» (owner, 20/11/2026): the period's positive samples in numbers only, never a patient:
// samples, patients, MDR/XDR and kinds of organism, then the 4 most frequent organisms with a bar (MDR/XDR in the
// colour of the weekly chart), the difference from the comparison period («+2», «−1», nothing when equal) and one
// line for the rest. A fixed number of lines: the card never scrolls.
interface OrganismsCardProps { overview: DepartmentHomeOverview | null, loading: boolean, language: string, action: ReactNode, periodText: string, comparing?: boolean }
export function OrganismsCard({ overview: o, loading, language, action, periodText, comparing = true }: OrganismsCardProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number | null | undefined) => loading || value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const rows = o?.organisms || []
  const top = Math.max(1, ...rows.map(row => row.count))
  const more = Math.max(0, (o?.organismsCount ?? 0) - rows.length)
  const figures: Array<[string, string, boolean]> = [
    [number(o?.positives), tr('θετικά δείγματα', 'positive samples'), false],
    [number(o?.patients), tr('ασθενείς', 'patients'), false],
    [number(o?.positivesMdr), 'MDR/XDR', Number(o?.positivesMdr) > 0],
    [number(o?.organismsCount), tr('είδη μικροβίων', 'kinds of organism'), false],
  ]
  return <Card className="dashboard-card dephome-organisms">
    <CardHeader title={tr('Μικρόβια του τμήματος', 'Department organisms')} subtitle={periodText} actions={action}/>
    <dl className="dephome-organism-figures">{figures.map(([value, label, danger]) => <div key={label}><dt>{label}</dt><dd className={danger ? 'is-danger' : undefined}>{value}</dd></div>)}</dl>
    {rows.length ? <ul className="dephome-organism-list">
      {rows.map(row => <li key={row.organism}>
        <em title={row.organism}>{row.organism}</em>
        <span className="dephome-organism-bar" role="img" aria-label={en ? `${row.count} samples, ${row.mdr} MDR/XDR` : `${row.count} δείγματα, ${row.mdr} MDR/XDR`}>
          <span style={{ width: `${row.count / top * 100}%`, background: SERIES_COLORS[0] }}><i style={{ width: `${row.mdr / row.count * 100}%`, background: SERIES_COLORS[1] }}/></span>
        </span>
        <b>{row.count}</b>
        {comparing ? <OrganismChange now={row.count} before={row.compareCount} en={en}/> : <span/>}
      </li>)}
      {more > 0 && <li className="is-more"><span>{en ? `+ ${more} more ${more === 1 ? 'kind' : 'kinds'}` : `+ ${more} ακόμη ${more === 1 ? 'είδος' : 'είδη'}`}</span><span/><b>{o?.organismsOtherCount ?? 0}</b><span/></li>}
    </ul> : <div className="inline-empty">{loading ? tr('Φόρτωση…', 'Loading…') : tr('Κανένα θετικό δείγμα στην περίοδο.', 'No positive samples in the period.')}</div>}
  </Card>
}

// The difference from the comparison period: more samples of an organism read as worse (red), fewer as better (green).
function OrganismChange({ now, before, en }: { now: number, before: number, en: boolean }) {
  const diff = now - before
  if (!diff) return <span className="dephome-organism-change"/>
  return <span className={`dephome-organism-change ${diff > 0 ? 'is-worse' : 'is-better'}`} title={en ? `${before} in the comparison period` : `${before} στην περίοδο σύγκρισης`}>{diff > 0 ? '+' : '−'}{Math.abs(diff)}</span>
}
