import { departmentProfile } from './executiveInsights'

const fmt = (value, unit, en) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}${unit || ''}`)

// «Τμήματα» (owner, 7–8/11/2026): «Σύγκριση τμημάτων», every department side by side (moved here from the summary),
// then one department's measures against the average of the departments and against the comparison.
export function ExecutiveDepartments({ grid, department, onDepartment, compareLabel, versus = compareLabel.toLowerCase(), language }) {
  const en = language === 'en'
  const tx = (el, english) => (en ? english : el)
  if (grid.rows.length < 2) return <div className="exec-empty-measures"><h4>{tx('Η σύγκριση τμημάτων δεν έχει ξεκινήσει ακόμη', 'The comparison of departments has not started yet')}</h4><p>{tx('Ξεκινά μόλις υπάρξουν καταγραφές σε δύο τουλάχιστον τμήματα.', 'It starts once at least two departments have records.')}</p></div>
  const name = grid.rows.some((row) => row.name === department) ? department : grid.rows[0].name
  const profile = departmentProfile(grid, name)
  return <div className="exec-departments">
    <section className="exec-dept-grid">
      <h3>{tx('Σύγκριση τμημάτων', 'Comparison of departments')} <small>{tx('χρώμα: σε σχέση με τον στόχο · βέλος: σε σχέση με', 'colour: against the target · arrow: against')} {versus}</small></h3>
      <div className="exec-dept-scroll"><table>
        <thead><tr><th>{tx('Τμήμα', 'Department')}</th>{grid.columns.map((column) => <th key={column.key}>{tx(...column.label)}</th>)}</tr></thead>
        <tbody>{grid.rows.map((row) => <tr key={row.name} className={row.name === name ? 'is-chosen' : undefined}><th scope="row"><button type="button" className="exec-measure-link" onClick={() => onDepartment(row.name)}>{row.name}</button></th>{row.cells.map((cell) => <td key={cell.key} className={`exec-cell-${cell.tone}`} title={cell.previous != null ? `${compareLabel}: ${fmt(cell.previous, cell.unit, en)}` : undefined}>{fmt(cell.value, cell.unit, en)}{cell.trend && <span className={cell.good ? 'is-better' : 'is-worse'}>{cell.trend === 'up' ? ' ▲' : ' ▼'}</span>}</td>)}</tr>)}</tbody>
      </table></div>
    </section>
    <section className="exec-dept-grid">
      <h3>{name} <small>{tx(`σε σχέση με τον μέσο όρο των τμημάτων και ${versus} · αλλάζει με κλικ σε άλλο τμήμα πάνω`, `against the departments' average and ${versus} · click another department above to change`)}</small></h3>
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
