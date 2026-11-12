import { Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { departmentProfile, type DepartmentGrid } from './executiveInsights'
import type { Translate } from '../../types/featureTypes'

const fmt = (value: number | null | undefined, unit: string | null | undefined, en: boolean) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

// One department's measures against the average of the departments and against the comparison.
function DepartmentDetail({ grid, name, compareLabel, tx, en }: { grid: DepartmentGrid, name: string, compareLabel: string, tx: Translate, en: boolean }) {
  const profile = departmentProfile(grid, name)
  return <table className="exec-dept-detail-table">
    <thead><tr><th>{tx('Δείκτης', 'Measure')}</th><th>{name}</th><th>{tx('Μέσος όρος τμημάτων', "Departments' average")}</th><th>{compareLabel}</th><th>{tx('Σύγκριση', 'Comparison')}</th></tr></thead>
    <tbody>{profile.map((row) => <tr key={row.key}>
      <th scope="row">{tx(...row.label)}</th>
      <td className={`exec-cell-${row.tone}`}>{fmt(row.value, row.unit, en)}{row.trend && <span className={row.good ? 'is-better' : 'is-worse'}>{row.trend === 'up' ? ' ▲' : ' ▼'}</span>}</td>
      <td>{fmt(row.average, row.unit, en)}</td>
      <td>{fmt(row.previous, row.unit, en)}</td>
      <td className={row.versus == null ? '' : row.versus ? 'is-better' : 'is-worse'}>{row.versus == null ? '—' : row.versus ? tx('Καλύτερα από τον μέσο όρο', 'Better than average') : tx('Χειρότερα από τον μέσο όρο', 'Worse than average')}</td>
    </tr>)}</tbody>
  </table>
}

// «Τμήματα» (owner, 7–8/11/2026): «Σύγκριση τμημάτων», the wards side by side; a click on a department opens its measures
// right under it (the others move down), a second click closes them.
interface ExecutiveDepartmentsProps { grid: DepartmentGrid, department: string, onDepartment: (name: string) => void, compareLabel: string, versus?: string, language: string }
export function ExecutiveDepartments({ grid, department, onDepartment, compareLabel, versus = compareLabel.toLowerCase(), language }: ExecutiveDepartmentsProps) {
  const en = language === 'en'
  const tx = (el: string, english: string) => (en ? english : el)
  if (grid.rows.length < 2) return <div className="exec-empty-measures"><h4>{tx('Η σύγκριση τμημάτων δεν έχει ξεκινήσει ακόμη', 'The comparison of departments has not started yet')}</h4><p>{tx('Ξεκινά μόλις υπάρξουν καταγραφές σε δύο τουλάχιστον τμήματα.', 'It starts once at least two departments have records.')}</p></div>
  const open = grid.rows.some((row) => row.name === department) ? department : ''
  const span = grid.columns.length + 1
  return <div className="exec-departments">
    <section className="exec-dept-grid">
      <h3>{tx('Σύγκριση τμημάτων', 'Comparison of departments')} <small>{tx('χρώμα: σε σχέση με τον στόχο · βέλος: σε σχέση με', 'colour: against the target · arrow: against')} {versus} · {tx('πατήστε ένα τμήμα για τις λεπτομέρειες', 'click a department for its details')}</small></h3>
      <div className="exec-dept-scroll"><table>
        <thead><tr><th>{tx('Τμήμα', 'Department')}</th>{grid.columns.map((column) => <th key={column.key}>{tx(...column.label)}</th>)}</tr></thead>
        <tbody>{grid.rows.map((row) => {
          const isOpen = row.name === open
          return <Fragment key={row.name}>
            <tr className={isOpen ? 'is-chosen' : undefined}>
              <th scope="row"><button type="button" className="exec-measure-link exec-dept-toggle" aria-expanded={isOpen} onClick={() => onDepartment(isOpen ? '' : row.name)}>{isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}{row.name}</button></th>
              {row.cells.map((cell) => <td key={cell.key} className={`exec-cell-${cell.tone}`} title={cell.previous != null ? `${compareLabel}: ${fmt(cell.previous, cell.unit, en)}` : undefined}>{fmt(cell.value, cell.unit, en)}{cell.trend && <span className={cell.good ? 'is-better' : 'is-worse'}>{cell.trend === 'up' ? ' ▲' : ' ▼'}</span>}</td>)}
            </tr>
            {isOpen && <tr className="exec-dept-detail"><td colSpan={span}><DepartmentDetail grid={grid} name={row.name} compareLabel={compareLabel} tx={tx} en={en} /><small>{tx(`Σε σχέση με τον μέσο όρο των τμημάτων και ${versus}.`, `Against the departments' average and ${versus}.`)}</small></td></tr>}
          </Fragment>
        })}</tbody>
      </table></div>
    </section>
  </div>
}
