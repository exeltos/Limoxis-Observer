import type { ReactNode } from 'react'
import { Card, CardHeader } from '../../design-system/Card'
import { SERIES_COLORS } from '../analysis/AnalysisCharts'
import type { DepartmentHomeOverview } from './departmentHomeModel'

// «Μικρόβια του τμήματος» (owner, 20/11/2026): the 30 days' positive samples in numbers only, never a patient:
// samples, patients, MDR/XDR and kinds of organism, then the 4 most frequent organisms with a bar (MDR/XDR in the
// colour of the weekly chart) and one line for the rest. A fixed number of lines: the card never scrolls.
interface OrganismsCardProps { overview: DepartmentHomeOverview | null, loading: boolean, language: string, action: ReactNode }
export function OrganismsCard({ overview: o, loading, language, action }: OrganismsCardProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const number = (value: number | null | undefined) => loading || value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(value)
  const rows = o?.organisms30 || []
  const top = Math.max(1, ...rows.map(row => row.count))
  const more = Math.max(0, (o?.organisms30Count ?? 0) - rows.length)
  const figures: Array<[string, string, boolean]> = [
    [number(o?.positives30), tr('θετικά δείγματα', 'positive samples'), false],
    [number(o?.patients30), tr('ασθενείς', 'patients'), false],
    [number(o?.positivesMdr30), 'MDR/XDR', Number(o?.positivesMdr30) > 0],
    [number(o?.organisms30Count), tr('είδη μικροβίων', 'kinds of organism'), false],
  ]
  return <Card className="dashboard-card dephome-organisms">
    <CardHeader title={tr('Μικρόβια του τμήματος', 'Department organisms')} subtitle={tr('30 ημέρες', '30 days')} actions={action}/>
    <dl className="dephome-organism-figures">{figures.map(([value, label, danger]) => <div key={label}><dt>{label}</dt><dd className={danger ? 'is-danger' : undefined}>{value}</dd></div>)}</dl>
    {rows.length ? <ul className="dephome-organism-list">
      {rows.map(row => <li key={row.organism}>
        <em title={row.organism}>{row.organism}</em>
        <span className="dephome-organism-bar" role="img" aria-label={en ? `${row.count} samples, ${row.mdr} MDR/XDR` : `${row.count} δείγματα, ${row.mdr} MDR/XDR`}>
          <span style={{ width: `${row.count / top * 100}%`, background: SERIES_COLORS[0] }}><i style={{ width: `${row.mdr / row.count * 100}%`, background: SERIES_COLORS[1] }}/></span>
        </span>
        <b>{row.count}</b>
      </li>)}
      {more > 0 && <li className="is-more"><span>{en ? `+ ${more} more ${more === 1 ? 'kind' : 'kinds'}` : `+ ${more} ακόμη ${more === 1 ? 'είδος' : 'είδη'}`}</span><span/><b>{o?.organismsOtherCount ?? 0}</b></li>}
    </ul> : <div className="inline-empty">{loading ? tr('Φόρτωση…', 'Loading…') : tr('Κανένα θετικό δείγμα τις τελευταίες 30 ημέρες.', 'No positive samples in the last 30 days.')}</div>}
  </Card>
}
