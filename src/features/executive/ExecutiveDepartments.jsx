import { departmentProfile } from './executiveInsights'

const fmt = (value, unit, en) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

// «Τμήματα» (owner, 7/11/2026): one department's measures against the average of the departments and against the
// comparison, the same figures as «Τμήματα με μια ματιά»; the department is chosen above.
export function ExecutiveDepartments({ grid, department, onDepartment, compareLabel, language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  if (grid.rows.length < 2) return <div className="exec-empty-measures"><h4>{tx('Χωρίς δεδομένα ακόμη', 'No data yet')}</h4><p>{tx('Τα τμήματα εμφανίζονται μόλις υπάρξουν καταγραφές ανά τμήμα.', 'Departments appear once there are records per department.')}</p></div>
  const name = grid.rows.some((row) => row.name === department) ? department : grid.rows[0].name
  const profile = departmentProfile(grid, name)
  return <div className="exec-departments">
    <div className="exec-department-picker" role="tablist" aria-label={tx('Τμήματα', 'Departments')}>
      {grid.rows.map((row) => <button key={row.name} type="button" role="tab" aria-selected={row.name === name} className={row.name === name ? 'is-active' : ''} onClick={() => onDepartment(row.name)}>{row.name}</button>)}
    </div>
    <section className="exec-dept-grid">
      <h3>{name} <small>{tx(`σε σχέση με τον μέσο όρο των τμημάτων και ${compareLabel.toLowerCase()}`, `against the departments' average and ${compareLabel.toLowerCase()}`)}</small></h3>
      <table>
        <thead><tr><th>{tx('Δείκτης', 'Measure')}</th><th>{name}</th><th>{tx('Μέσος όρος τμημάτων', "Departments' average")}</th><th>{compareLabel}</th><th>{tx('Σύγκριση', 'Comparison')}</th></tr></thead>
        <tbody>{profile.map((row) => <tr key={row.key}>
          <th scope="row">{tx(...row.label)}</th>
          <td className={`exec-cell-${row.tone}`}>{fmt(row.value, row.unit, en)}{row.trend && <span className={row.good ? 'is-better' : 'is-worse'}>{row.trend === 'up' ? ' ▲' : ' ▼'}</span>}</td>
          <td>{fmt(row.average, row.unit, en)}</td>
          <td>{fmt(row.previous, row.unit, en)}</td>
          <td className={row.versus == null ? '' : row.versus ? 'is-better' : 'is-worse'}>{row.versus == null ? '—' : row.versus ? tx('Καλύτερα από τον μέσο όρο', 'Better than average') : tx('Χειρότερα από τον μέσο όρο', 'Worse than average')}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>
}
